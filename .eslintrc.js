module.exports = {
    env: {
        browser: true,
        commonjs: true,
        es2021: true,
        jquery: true,
    },
    extends: "eslint:recommended",
    parserOptions: {
        ecmaVersion: 13,
        sourceType: "module",
    },
    ignorePatterns: ["assets/built/", "assets/js/lib/"],
    rules: {
        "no-undef": "warn",
    },
};
