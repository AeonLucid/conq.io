var del = require('del');
var gulp = require('gulp');
var gts = require('gulp-typescript');
var babel = require('gulp-babel');
var print = require('gulp-print');
var run_sequence = require('run-sequence');
var order = require('gulp-order');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var uglify_css = require('gulp-clean-css');
var uglify_html = require('gulp-htmlmin');
var browser_sync = require('browser-sync');
var nodemon = require('gulp-nodemon');

var reload = browser_sync.reload;

var tsconfig = {
    target: "es2015",
    module: "commonjs",
    sourceMap: true,
    strictNullChecks: true
};

var bbonfig = {
    presets: ["es2015"],
    minified: true
}

gulp.task("default", ["rebuild"]);

// Compile and uglify typescript code for client
gulp.task("build-client", function () {
    var res = gulp.src("src/public/**/*.ts")
        .pipe(order([
            "src/public/socket.ts",
            "src/public/!(start)*.ts",
            "src/public/start.ts"
        ], { base: './' }))
        .pipe(print())
        .pipe(gts(tsconfig))
        .pipe(concat("script.js"))
        //.pipe(babel(bbonfig))
        //.pipe(uglify())
        .pipe(gulp.dest("dist/public"));
    return res;
});

// Compile and uglify typescript code for server
gulp.task("build-server", function () {
    var res = gulp.src("src/server/**/*.ts")
        .pipe(gts(tsconfig))
        //.pipe(babel(bbonfig))
        //.pipe(uglify())
        .pipe(gulp.dest("dist/server"));
    return res;
});

// Compile and uglify html and css code for client
gulp.task("build-view", ["build-html", "build-css"]);

// Copy and uglify html code for client
gulp.task("build-html", function () {
    var settings = {
        collapseWhitespace: true,
        removeComments: true
    };

    var res = gulp.src("src/view/**/*.html")
        .pipe(uglify_html(settings))
        .pipe(gulp.dest("dist/public"));
    return res;
});

// Copy and uglify css code for client
gulp.task("build-css", function () {
    var res = gulp.src("src/view/**/*.css")
        .pipe(uglify_css())
        .pipe(gulp.dest("dist/public"));
    return res;
});

// Build the whole application to dest
gulp.task("build", ["build-client", "build-server", "build-view"]);

// Clean the build folder
gulp.task("clean", function () {
    var res = del(["dist/**/*"]);
    return res;
});

// Clean the build folder and rebuild the applicaton
gulp.task("rebuild", function () {
    var res = run_sequence('clean', 'build');
    return res;
});

// Initializes watchers for automatically building files, restarting
// the server and reloading the page.
gulp.task("watch", ["nodemon-init", "browser-sync-init", "watch-files"]);

// Call the appropriate build task when the working directory change
gulp.task("watch-files", function () {
    gulp.watch("src/public/**/*.ts", ["build-client"]);
    gulp.watch("src/server/**/*.ts", ["build-server"]);
    gulp.watch("src/view/**/*.*", ["build-view"]);
});

// Reloads the browsers on file change
gulp.task("browser-sync-init", function () {
    var res = browser_sync({
        proxy: "localhost:3000",
        port: 5000,
        notify: true
    });
    return res;
});

// Restarts the server on file change
gulp.task("nodemon-init", function () {
    var res = nodemon({
        script: "dist/server/init.js",
        watch: "src/**/*.*"
    });

    res.on("start", function () {
        setTimeout(function () {
            reload({ stream: false });
        }, 1000);
    });

    return res;
})