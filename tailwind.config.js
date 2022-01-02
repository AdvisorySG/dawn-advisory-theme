module.exports = {
    mode: "jit",
    content: [
        "*.hbs",
        "**/*.hbs",
        "assets/built/**/*.js",
        "!node_modules/**/*.hbs",
    ],
    darkMode: "class",
    theme: {
        extend: {},
    },
    variants: {
        extend: {},
    },
    plugins: [],
};
