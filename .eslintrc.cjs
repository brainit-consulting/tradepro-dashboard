module.exports = {
  env: {
    browser: true,
    es2021: true
  },
  plugins: ["html"],
  settings: {
    "html/html-extensions": [".html"]
  },
  rules: {
    eqeqeq: "warn",
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]
  }
};
