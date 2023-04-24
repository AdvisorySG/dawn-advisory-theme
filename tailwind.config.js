module.exports = {
    mode: "jit",
    content: [
        "*.hbs",
        "**/*.hbs",
        "assets/built/**/*.js",
        "!node_modules/**/*.hbs",
    ],
    safelist: ["bg-amber-300", "text-sm", "text-gray-800"],
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
