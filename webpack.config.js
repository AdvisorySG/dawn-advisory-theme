const isProduction = process.env.NODE_ENV == "production";

module.exports = {
    devtool: "inline-source-map",
    mode: isProduction ? "production" : "development",
    output: { filename: "main.js" },
    stats: "minimal",
};
