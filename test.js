const chokidar = require('chokidar');
const fs = require("fs");
const server = require("./server.js");
const http = require("http");
const EventSource = require("eventsource");
const url = require("url");

const test = async function () {
    const [watcher, listener, password] = await server.start("testdir");
    const port = listener.address().port;

    const authDetails = Buffer.from(`sync:${password}`).toString("base64");
    const authHeader =  { "Authorization": "Basic " + authDetails };
    const es = new EventSource(`http://localhost:${port}/sync/stream`, {
        headers: authHeader
    });

    console.log("es!", es, port, password);

    es.addEventListener("sync", esEvt => {
        const rawData = esEvt.data;
        try {
            console.log("esEvt", rawData);
            const data = JSON.parse(rawData);
            console.log("data", data);
        }
        catch (e) {
            console.log("test.js - error parsing JSON from log event:", e);
        }
    });


    setTimeout(timeEvt => {
        fs.promises.writeFile("testdir/fileb", "hello world!");
    }, 2000);

    setTimeout(timeEvt => {
        fs.promises.writeFile("testdir/dir1/filec", "goodbye world!");
    }, 2000);
}

test().then();

// End
