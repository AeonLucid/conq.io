import express = require("express");
import http = require("http");
import express_core = require("express-serve-static-core");

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

}