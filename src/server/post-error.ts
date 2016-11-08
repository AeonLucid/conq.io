import express = require("express");
import express_core = require("express-serve-static-core");

function run(app: express_core.Express) {
	app.use(function(req, res, next) {
		let error: any;
		error = new Error("Not Found");
		error.status = 404;
		next(error);
	});

	// Development error handler will print stacktrace
	if (app.get("env") === "development") {
		app.use(<express_core.RequestHandlerParams>((error, request, response, next) => {
			response.send(error);
		}));
	// Production error handle no stacktraces leaked to user
	} else {
		app.use(<express_core.RequestHandlerParams>((error, request, response, next) => {
			/* Nothing */
		}));
	}	
}

export = run;