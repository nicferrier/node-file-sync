const chokidar = require('chokidar');
const fs = require("fs");
const SSE = require("sse-node");
const express = require("express");
const basicAuth = require("express-basic-auth");
const crypto = require("crypto");
const remoteAddr = require("./remoteaddr.js");

async function genPass() {
    const password = await new Promise((resolve, reject) => {
        crypto.pseudoRandomBytes(128, function(err, raw) {
            if (err) reject(err);
            else resolve(raw.toString("base64"));
        });
    });
    return password;
}

const connections = {};

const watch = async function (dir) {
    // One-liner for current directory, ignores .dotfiles
    const watchObject = chokidar.watch(dir, {ignored: /(^|[\/\\])\../});
    watchObject.on('all', (event, path) => {
        const connectionList = Object.keys(connections);
        console.log("watcher", event, path, connectionList.length);
        connectionList.forEach(connectionKey => {
            const connection = connections[connectionKey];
            connection.send([event, path], "sync");
        });
    });
    return watchObject;
}

exports.start = async function (dir, port=0) {
    let password;
    const userList = async () => {
        const pw = await genPass();
        password = pw;
        return {users: {"sync":pw}};
    };

    const authMake = async () => { return basicAuth(await userList()); };
    const auth = await authMake();
    const app = express();
    app.get(`/sync/stream`, auth, function (req, response) {
        const remoteIp = remoteAddr.get(req);
        console.log("wiring up comms from", remoteIp);
        const connection = SSE(req, response, {ping: 10*1000});
        connection.onClose(closeEvt => {
            console.log("sse closed");
            delete connections[remoteIp];
        });
        connections[remoteIp] = connection;
        connection.send({remote: remoteIp}, "meta");
    });

    return new Promise((resolve, reject) => {
        const watcher = watch(dir);
        const listener = app.listen(port, () => {
            console.log("started!");
            resolve([watcher, listener, password]);
        });
    });
};

// End
