'use strict';

const express = require('express');
const app = express();

process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

// enable request body parsing
const bodyParser = require('body-parser');
app.use(bodyParser.json());

// set the view engine to ejs
app.set('view engine', 'ejs');

// routes
app.use('/', require('./routes/profile')());
// app.use('/comment', require('./routes/comment')());

app.use(express.static('public'));

// start server
const port = process.env.PORT || 3000;
const server = app.listen(port);
console.log('Express started. Listening on %s', port);

// setup mongo client
const { dbName } = require('./db/config');
const mongoWrapper = require('./db/mongodb')
const db = mongoWrapper(process.env.MongoURL);
(
    async function () {
        const mongodb = await db.init(dbName);
        app.set('db', mongodb);
    }
)();

// resource cleanup on server shutdown
function shutDown() {
    server.close(async () => {
        console.log("initiating server shutdown...")
        await db.close();
        console.log("shutdown complete.")
    })
}
