module.exports = {
    mode: "jit",
    purge: [
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
    plugins: [
        require('@tailwindcss/line-clamp'),
    ],
};
