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

// Compile and uglify typescript for client
gulp.task("build-client", function() {
    var res = gulp.src("src/public/**/*.ts")
        .pipe(gts(tsconfig))
        .pipe(babel(bbonfig))
        .pipe(order([
            "src/public/!(start)*.js",
            "src/public/start.js"
        ], {base: './'}))
        .pipe(print())
        .pipe(concat("script.js"))
        .pipe(uglify())
        .pipe(gulp.dest("dist/public"));
    return res;
});

// Compile and uglify typescript for client
gulp.task("build-server", function() {
    var res = gulp.src("src/server/**/*.ts")
        .pipe(gts(tsconfig))
        .pipe(babel(bbonfig))
        .pipe(uglify())
        .pipe(gulp.dest("dist/server"));
    return res;
});

gulp.task("build-view", [ "build-html", "build-css" ]);

// Copy and uglify html for client
gulp.task("build-html", function() {
    var settings = {
        collapseWhitespace: true,
        removeComments: true
    };

    var res = gulp.src("src/view/**/*.html")
        .pipe(uglify_html(settings))
        .pipe(gulp.dest("dist/public"));
    return res;
});


// Copy and uglify css for client
gulp.task("build-css", function() {
    var res = gulp.src("src/view/**/*.css")
        .pipe(uglify_css())
        .pipe(gulp.dest("dist/public"));
    return res;
});

// Build the application to dest
gulp.task("build", ["build-client", "build-server", "build-view"]);

// Clean the dest folder
gulp.task("clean", function() {
    var res = del(["dist/**/*"]);
    return res;
});

// Clean the dest folder and rebuild the applicaton
gulp.task("rebuild", function() {
    var res = run_sequence('clean', 'build');
});

// Call the appropriate build task when the working directory change
gulp.task("watch", function() {
    gulp.watch("src/public/**/*.ts", ["build-client"]);
    gulp.watch("src/server/**/*.ts", ["build-server"]);
    gulp.watch("src/view/**/*.*", ["build-view"]);
});
