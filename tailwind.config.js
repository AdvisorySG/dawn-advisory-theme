module.exports = {
    mode: "jit",
    content: [
        "*.hbs",
        "**/*.hbs",
        "assets/built/**/*.js",
        "!node_modules/**/*.hbs",
    ],
    theme: {
        colors: {
            brand: {
                light: "#ffad33",
                DEFAULT: "#f49200",
            },
        },
        extend: {},
    },
    variants: {
        extend: {
            padding: ["hover"],
        },
    },
    plugins: [require("@tailwindcss/line-clamp")],
};
