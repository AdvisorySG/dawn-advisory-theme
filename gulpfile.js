const { series, parallel, watch, src, dest } = require("gulp");
const pump = require("pump");
const compiler = require("webpack");
const webpack = require("webpack-stream");

// gulp plugins and utils
const livereload = require("gulp-livereload");
const postcss = require("gulp-postcss");
const zip = require("gulp-zip");

// postcss plugins
const easyimport = require("postcss-easy-import");
const autoprefixer = require("autoprefixer");
const cssnano = require("cssnano");
const tailwindcss = require("tailwindcss");

function serve(done) {
    livereload.listen();
    done();
}

function handleError(done) {
    return function (err) {
        return done(err);
    };
}

function hbs(done) {
    pump(
        [
            src([
                "*.hbs",
                "partials/**/*.hbs",
                "members/**/*.hbs",
                "!node_modules/**/*.hbs",
            ]),
            livereload(),
        ],
        handleError(done)
    );
}

function css(done) {
    pump(
        [
            src("assets/css/screen.css", { sourcemaps: true }),
            postcss([easyimport, tailwindcss, autoprefixer(), cssnano()]),
            dest("assets/built/", { sourcemaps: "." }),
            livereload(),
        ],
        handleError(done)
    );
}

function js(done) {
    pump(
        [
            src("assets/js/main.js"),
            webpack(require("./webpack.config.js"), compiler),
            dest("assets/built/", { sourcemaps: "." }),
            livereload(),
        ],
        handleError(done)
    );
}

function zipper(done) {
    const filename = require("./package.json").name + ".zip";

    pump(
        [
            src([
                "**",
                "!node_modules",
                "!node_modules/**",
                "!dist",
                "!dist/**",
            ]),
            zip(filename),
            dest("dist/"),
        ],
        handleError(done)
    );
}

const hbsWatcher = () =>
    watch(["*.hbs", "partials/**/*.hbs", "members/**/*.hbs"], hbs);
const cssWatcher = () => watch("assets/css/**/*.css", css);
const jsWatcher = () => watch("assets/js/**/*.js", js);
const watcher = parallel(hbsWatcher, cssWatcher, jsWatcher);
const build = series(css, js);

exports.build = build;
exports.zip = series(build, zipper);
exports.default = series(build, serve, watcher);
