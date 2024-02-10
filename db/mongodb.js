const { MongoClient } = require('mongodb');
const { collections, sequences } = require("./config");

const DefaultMongoURL = "mongodb://localhost:27017/";
const profileSchema = {
    bsonType: "object",
    required: ["name"],
    properties: {
        name: {
            bsonType: "string",
            description: "Profile name - Required."
        },
    },
};
const commentSchema = {
    bsonType: "object",
    required: ["user_id"],
    properties: {
        user_id: {
            bsonType: "int",
            description: "User id - Required.",
        },
    },
};

const likeSchema = {
    bsonType: "object",
    required: ["comment_id"],
    properties: {
        comment_id: {
            bsonType: "int",
            description: "Comment id - Required.",
        },
        user_id: {
            bsonType: "int",
            description: "User id - Required.",
        },
    },
};

module.exports = function (mongoURL) {
    let mongoclient;
    return {
        init: async function (dbName) {
            try {
                mongoclient = await MongoClient.connect(mongoURL || DefaultMongoURL);
                const db = mongoclient.db(dbName);
                const dbCollectionss = await db.listCollections().toArray();
                if (dbCollectionss.length > 0) {
                    return db;
                }
                await Promise.all([
                    db.createCollection(collections.profiles, { validator: { $jsonSchema: profileSchema } }),
                    db.createCollection(collections.comments, { validator: { $jsonSchema: commentSchema } }),
                    db.createCollection(collections.likes, { validator: { $jsonSchema: likeSchema } }),
                    db.createCollection(collections.counters),
                ]);
                await initializeCountersFor([sequences.profile, sequences.comment, sequences.likes], db);
                return db
            } catch (e) {
                console.log(`failed to connect to mongo server: ${e}`)
            }
        },
        close: async function () {
            if (mongoclient) {
                await mongoclient.close();
            }
        },
        collections,
    }
}

async function initializeCountersFor(names, db) {
    names.forEach(async collID => {
        await db.collection(collections.counters).insertOne({
            _id: collID,
            seq: 0,
        });
    });
}
