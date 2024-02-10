const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const { dbName } = require('../db/config');
const { SortOptions } = require("./common");

describe('Profile API', () => {
    let mongoServer;
    let mongodb;
    let app;

    beforeAll(async () => {
        app = express();
        app.set('view engine', 'ejs');
        app.use(bodyParser.json());
        app.use('/', require('./profile')());

        mongoServer = await MongoMemoryServer.create({ instance: { dbName } });
        mongodb = require('../db/mongodb')(mongoServer.getUri());
        const db = await mongodb.init(dbName);
        app.set('db', db);
    });

    afterAll(async () => {
        mongodb.close();
        mongoServer.stop();
    });

    describe('POST /profiles', () => {
        it('create profile - successfull', async () => {
            const profileData = {
                "name": "profile 1",
                "description": "Adolph Larrue Martinez III.",
                "mbti": "ISFJ",
                "enneagram": "9w3",
                "variant": "sp/so",
                "tritype": 725,
                "socionics": "SEE",
                "sloan": "RCOEN",
                "psyche": "FEVL",
                "image": "https://soulverse.boo.world/images/1.png"
            };
            const response = await request(app).post('/profiles').send(profileData);
            expect(response.statusCode).toBe(201);
            expect(response.body).toEqual({ result: 'profile created successfully' });
        });

        it('create profile - failed, if profile name is missing', async () => {
            const profileData = {
                "description": "Adolph Larrue Martinez III.",
                "mbti": "ISFJ",
                "enneagram": "9w3",
                "variant": "sp/so",
                "tritype": 725,
                "socionics": "SEE",
                "sloan": "RCOEN",
                "psyche": "FEVL",
                "image": "https://soulverse.boo.world/images/1.png"
            };
            const response = await request(app).post('/profiles').send(profileData);
            expect(response.statusCode).toBe(400);
            expect(response.body).toEqual({
                error: {
                    "description": "name is required",
                    "type": "schema_validation",
                }
            });
        });
    });

    describe('GET /profiles/:id', () => {
        it('get profile - successfull', async () => {
            const response = await request(app).get('/profiles/1');
            expect(response.statusCode).toBe(200);
        });
        it('get profile - fail with invalid profile id', async () => {
            const response = await request(app).get('/profiles/2222');
            expect(response.statusCode).toBe(404);
        });
    });

    describe('POST /profiles/:id/comment', () => {
        it('create comment - successfull', async () => {
            const profile_id = 1;
            const profile2 = { name: "profile 2" }
            const comment = {
                "user_id": 2,
                "title": "test comment - 1",
                "description": "Elon musk is a genious",
                "mbti": "ENTJ",
                "enneagram": "",
                "zodiac": ""
            }
            await request(app).post('/profiles').send(profile2);

            const response = await request(app).post(`/profiles/${profile_id}/comment`).send(comment);
            expect(response.statusCode).toBe(201);
            expect(response.body).toEqual({ result: 'comment created successfully' });
        });
        it('create comment - failed if commenting user id does not exists', async () => {
            const profile_id = 1;
            const profile1 = {
                "name": "Elon Musk2",
            };
            const profile2 = {
                "name": "John Doe2",
            };
            const comment = {
                "user_id": 1001,
                "title": "test comment",
                "description": "Elon musk is a genious",
                "mbti": "ENTJ",
                "enneagram": "",
                "zodiac": ""
            }
            await request(app).post('/profiles').send(profile1);
            await request(app).post('/profiles').send(profile2);

            const response = await request(app).post(`/profiles/${profile_id}/comment`).send(comment);
            expect(response.statusCode).toBe(404);
            expect(response.body).toEqual({ error: `either profile id or user id doesn't exists` });
        });
        it('create comment - failed if no voting or title or description provided', async () => {
            const profile_id = 1;
            const comment = {
                "user_id": 2,
                "title": "",
                "description": "",
                "mbti": "",
                "enneagram": "",
                "zodiac": ""
            }

            const response = await request(app).post(`/profiles/${profile_id}/comment`).send(comment);
            expect(response.statusCode).toBe(400);
            expect(response.body).toEqual({ error: `atleast a voting or title or description is required` });
        });
    });

    describe('GET /profiles/:id/comments', () => {
        it('get comments - successfull', async () => {
            const profile_id = 1;
            const profile3 = { name: "profile 3" }
            const comment = {
                "user_id": 3,
                "title": "test comment",
                "description": "Elon musk is the owner of X",
                "mbti": "",
                "enneagram": "",
                "zodiac": "cancer"
            }
            await request(app).post('/profiles').send(profile3);
            await request(app).post(`/profiles/${profile_id}/comment`).send(comment); // add more comments

            const response = await request(app).get(`/profiles/${profile_id}/comments`)
            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('result');
            expect(response.body.result.length).toEqual(2)
        });
        it('get comments - failed with invalid profile id', async () => {
            const invalid_profile_id = 10001;
            const response = await request(app).get(`/profiles/${invalid_profile_id}/comments`)
            expect(response.statusCode).toBe(404);
        });
    });

    describe('POST /comments/:id/like', () => {
        it('create like - successfull', async () => {
            const comment_id = 1;
            const like = {
                "user_id": 2,
            }

            const response = await request(app).post(`/comments/${comment_id}/like`).send(like);
            expect(response.statusCode).toBe(201);
            expect(response.body).toEqual({ result: 'like added successfully' });
        });
        it('create like - failed if comment does not exists', async () => {
            const invalid_comment_id = 1001;
            const like = {
                "user_id": 2,
            }

            const response = await request(app).post(`/comments/${invalid_comment_id}/like`).send(like);
            expect(response.statusCode).toBe(404);
            expect(response.body).toEqual({ error: `comment not found` });
        });
        it('create like - failed if commenter does not exists', async () => {
            const comment_id = 1;
            const like = {
                "user_id": 2001,
            }

            const response = await request(app).post(`/comments/${comment_id}/like`).send(like);
            expect(response.statusCode).toBe(404);
            expect(response.body).toEqual({ error: `user not found` });
        });
        it('create like - failed if user already liked the comment', async () => {
            const comment_id = 1;
            const like = {
                "user_id": 2,
            }

            const response = await request(app).post(`/comments/${comment_id}/like`).send(like);
            expect(response.statusCode).toBe(409);
            expect(response.body).toEqual({ error: `comment already like by the user` });
        });
    });

    describe('DELETE /comments/:id/unlike', () => {
        it('unlike comment - successfull', async () => {
            const comment_id = 1;
            const unlike = {
                "user_id": 2,
            }

            const response = await request(app).delete(`/comments/${comment_id}/unlike`).send(unlike);
            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual({ result: 'liked removed successfully' });
        });
        it('unlike comment - failed if comment does not exists', async () => {
            const invalid_comment_id = 1;
            const unlike = {
                "user_id": 2,
            }

            const response = await request(app).delete(`/comments/${invalid_comment_id}/unlike`).send(unlike);
            expect(response.statusCode).toBe(404);
            expect(response.body).toEqual({ result: `no like found by user: ${unlike.user_id} on comment: ${invalid_comment_id}` });
        });
    });

    describe('SORT comments', () => {
        it('sortby: recent', async () => {
            const profile_id = 1;
            const profile4 = { name: "profile 4" }
            const comment = {
                "user_id": 4,
                "title": "test comment by profile 4",
                "description": "Elon musk believes in free speech",
                "mbti": "",
                "enneagram": "1w2",
                "zodiac": ""
            }
            await request(app).post('/profiles').send(profile4);
            await request(app).post(`/profiles/${profile_id}/comment`).send(comment); // add more comments

            const response = await request(app).get(`/profiles/${profile_id}/comments?sortby=${SortOptions.recent}`)
            expect(response.body.result[0].title).toBe(comment.title);
        });
        it('sortby: best', async () => {
            const profile_id = 1;
            const comment_id = 1;
            await request(app).post(`/comments/${comment_id}/like`).send({ "user_id": 2 });
            await request(app).post(`/comments/${comment_id}/like`).send({ "user_id": 3 });
            await request(app).post(`/comments/${comment_id}/like`).send({ "user_id": 4 });

            const response = await request(app).get(`/profiles/${profile_id}/comments?sortby=${SortOptions.best}`)
            expect(response.body.result[0].likes).toBe(3);
            expect(response.body.result[0].title).toBe("test comment - 1");
        });
    });

    describe('FILTER comments', () => {
        it('filter: all', async () => {
            const profile_id = 1;
            const response = await request(app).get(`/profiles/${profile_id}/comments?filter=all`)
            expect(response.body.result.length).toBe(3);
        });
        it('filter: mbti', async () => {
            const profile_id = 1;
            const response = await request(app).get(`/profiles/${profile_id}/comments?filter=mbti`)
            expect(response.body.result.length).toBe(1);
        });
        it('filter: zodiac', async () => {
            const profile_id = 1;
            const response = await request(app).get(`/profiles/${profile_id}/comments?filter=zodiac`)
            expect(response.body.result.length).toBe(1);
        });
        it('filter: enneagram', async () => {
            const profile_id = 1;
            const response = await request(app).get(`/profiles/${profile_id}/comments?filter=enneagram`)
            expect(response.body.result.length).toBe(1);
        });
    });
});