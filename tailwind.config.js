module.exports = {
    mode: "jit",
    content: [
        "*.hbs",
        "**/*.hbs",
        "assets/built/**/*.js",
        "!node_modules/**/*.hbs",
    ],
    theme: {
        extend: {},
    },
    variants: {
        extend: {
            padding: ["hover"],
        },
    },
    plugins: [require("@tailwindcss/line-clamp")],
};
