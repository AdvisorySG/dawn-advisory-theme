module.exports = {
    mode: "jit",
    content: [
        "*.hbs",
        "**/*.hbs",
        "assets/built/**/*.js",
        "!node_modules/**/*.hbs",
    ],
    safelist: [
        "bg-amber-300",
        "text-sm",
        "text-gray-800",
        "h-6",
        "capitalize",
        "mr-1",
    ],
    theme: {
        colors: {
            brand: {
                light: "#ffad33",
                DEFAULT: "#f49200",
            },
        },
        extend: {
            boxShadow: {
                "featured-article": "0px 10px 50px -6px rgb(0 0 0 / 25%)",
            },
        },
    },
    variants: {
        extend: {
            padding: ["hover"],
        },
    },
    plugins: [require("@tailwindcss/line-clamp")],
};
