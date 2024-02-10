'use strict';
const express = require('express');
const router = express.Router();
const { collections, sequences } = require('../db/config');
const { aggregateSchemaValidationErrors, getNextSequence, stepSequenceBack, rollBackSequence } = require("./common")
const { MongoServerError } = require('mongodb');
const { SortOptions } = require("./common");

const SortColumns = {
  createdAt: "created_at",
  likes: "likes"
}
const FilterOptions = {
  mbti: "mbti",
  enneagram: "enneagram",
  zodiac: "zodiac"
}

module.exports = function () {
  router.get('/profiles/:id', async function (req, res, next) {
    const db = req.app.get('db');
    const { id: profile_id } = req.params
    const profile = await db.collection(collections.profiles).findOne({ 'id': Number(profile_id) });
    if (!profile) {
      res.status(404).send('profile not found')
      return
    }
    profile.image = "/static/elon-musk.jpg"; // same image for every profile
    res.render('profile_template', {
      profile,
    });
  });

  router.post('/profiles', async function (req, res) {
    let db;
    try {
      db = req.app.get('db');
      const profile = req.body;
      const profile_id = await getNextSequence(sequences.profile, db);
      profile.id = profile_id;
      await db.collection(collections.profiles).insertOne(profile);
      res.status(201).send({ result: 'profile created successfully' })
    } catch (error) {
      await rollBackSequence(sequences.profile, db);
      if (error instanceof MongoServerError) {
        res.status(400).send(aggregateSchemaValidationErrors(error))
        return
      }
      res.status(500).send({ error: 'faild to create new profile' })
    }
  })

  router.post('/profiles/:id/comment', async function (req, res) {
    try {
      const db = req.app.get('db');
      const { id: profile_id } = req.params
      const comment = req.body;
      if (!isValidComment(comment)) {
        res.status(400).send({ error: 'atleast a voting or title or description is required' })
        return
      }

      const users = await db.collection(collections.profiles).find({
        $or: [
          { id: Number(profile_id) },
          { id: comment.user_id }
        ]
      }).toArray();
      if (users.length < 2) {
        res.status(404).send({ error: `either profile id or user id doesn't exists` });
        return
      }

      const comment_id = await getNextSequence(sequences.comment, db);
      comment.profile_id = Number(profile_id);
      comment.created_at = new Date().toISOString();
      comment.likes = 0;
      comment.id = comment_id;
      await db.collection(collections.comments).insertOne(comment);
      res.status(201).send({ result: 'comment created successfully' })
    } catch (error) {
      if (error instanceof MongoServerError) {
        res.status(400).send(aggregateSchemaValidationErrors(error))
        return
      }
      res.status(500).send({ error: 'faild to create new comment' })
    }
  });

  router.get('/profiles/:id/comments', async function (req, res) {
    try {
      const db = req.app.get('db');
      const { id: profile_id } = req.params
      let query = { profile_id: Number(profile_id) };

      const { filter, sortby } = req.query;
      if (filter && filter != "all") {
        if (FilterOptions[filter] == null) {
          res.status(400).send({ error: 'invalid filter option provided' })
          return
        }
        query[filter] = { $ne: "" }
      }

      let commentQuery = db.collection(collections.comments).find(query, { projection: { _id: 0 } });
      if (sortby && (sortby == SortOptions.recent || sortby == SortOptions.best)) {
        commentQuery = sortby == SortOptions.recent ? commentQuery.sort({ [SortColumns.createdAt]: -1 }) : commentQuery.sort({ [SortColumns.likes]: -1 })
      }

      const comments = await commentQuery.toArray();
      if (comments.length == 0) {
        res.status(404).send({ result: [] });
        return
      }
      res.status(200).send({ result: comments })
    } catch (error) {
      if (error instanceof MongoServerError) {
        res.status(400).send(aggregateSchemaValidationErrors(error))
        return
      }
      res.status(500).send({ error: 'faild to create new comment' })
    }
  });

  router.post('/comments/:id/like', async function (req, res) {
    try {
      const db = req.app.get('db');
      const { id: comment_id } = req.params;

      const comment = await db.collection(collections.comments).findOne({ 'id': Number(comment_id) });
      if (!comment) {
        res.status(404).send({ error: 'comment not found' })
        return
      }

      const like = req.body;
      const user = await db.collection(collections.profiles).findOne({ 'id': like.user_id });
      if (!user) {
        res.status(404).send({ error: 'user not found' })
        return
      }

      const userLikeRecord = await db.collection(collections.likes).findOne({ "comment_id": Number(comment_id), "user_id": like.user_id })
      if (userLikeRecord) {
        res.status(409).send({ error: 'comment already like by the user' })
        return
      }

      const like_id = await getNextSequence(sequences.likes, db);
      like.comment_id = Number(comment_id)
      like.created_at = new Date().toISOString();
      like.id = like_id;

      await Promise.all([
        db.collection(collections.likes).insertOne(like),
        db.collection(collections.comments).updateOne({ "id": Number(comment_id) }, { "$inc": { "likes": 1 } })
      ]);
      res.status(201).send({ result: 'like added successfully' })
    } catch (error) {
      if (error instanceof MongoServerError) {
        res.status(400).send(aggregateSchemaValidationErrors(error))
        return
      }
      res.status(500).send({ error: 'failed to add the like' })
    }
  });

  router.delete('/comments/:id/unlike', async function (req, res) {
    try {
      const db = req.app.get('db');
      const { id: comment_id } = req.params;
      const { user_id } = req.body;

      const likeRecord = await db.collection(collections.likes).findOne({ "comment_id": Number(comment_id), "user_id": user_id });
      if (!likeRecord) {
        res.status(404).send({ result: `no like found by user: ${user_id} on comment: ${comment_id}` })
        return
      }
      await db.collection(collections.likes).deleteOne({ "comment_id": Number(comment_id), "user_id": user_id });
      await db.collection(collections.comments).updateOne({ "id": Number(comment_id) }, { "$inc": { "likes": -1 } })
      res.status(200).send({ result: 'liked removed successfully' })
    } catch (error) {
      if (error instanceof MongoServerError) {
        res.status(400).send(aggregateSchemaValidationErrors(error))
        return
      }
      res.status(500).send({ error: 'faild to remove the like' })
    }
  });

  return router;
}

function isValidComment(comment) {
  return comment.title || comment.description || comment.mbti ||
    comment.enneagram || comment.zodiac
}
