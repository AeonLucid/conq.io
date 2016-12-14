import express = require("express");
import http = require("http");
import express_core = require("express-serve-static-core");
import wsw = require("./socket");
import uws = require("./uws-socket");

export let app: express_core.Express;
export let server: http.Server;

export function init() {
	// Initialize file routers
	app.get("/", (req, res) => {
		res.sendFile("../public/index.html");
	});
	require("./post-error")(app);

	main();
	console.log("Server is running");
}

function main() {
	let handler = uws(server);
	let socket = new wsw.Server(handler.handler);
}