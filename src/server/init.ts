import express = require("express");
import path = require("path");
import http = require("http");

let program = require("./app");
let app = express();
let server: http.Server;

// Initialize server
let port = normalizePort(process.env.PORT || "3000");
app.set("port", port);
server = http.createServer(app);
server.listen(port);
server.on("error", errorCallback);
server.on("listening", listeningCallback);

app.use(express.static(path.join(__dirname, "../public")));

function normalizePort(value) {
    let port = parseInt(value, 10);

    if (isNaN(port)) {
        return value;
    }

    if (port >= 0) {
        return port;
    }

    return false;
}

function errorCallback(error) {
    if (error.syscall !== "listen")
        throw error;

    let bind = typeof port === "string"
        ? "Pipe " + port
        : "Port " + port;

    // Handle specific listen errors with friendly messages
    switch (error.code) {
        case "EACCES":
            console.error(bind + " requires elevated privileges");
            process.exit(1);
            break;
        case "EADDRINUSE":
            console.error(bind + " is already in use");
            process.exit(1);
            break;
        default:
            throw error;
    }
}

function listeningCallback() {
    let addr = server.address();
    let bind = typeof addr === "string"
        ? "pipe " + addr
        : "port " + addr.port;
    console.log("Listening on " + bind);
}

program.app = app;
program.server = server;
program.init();