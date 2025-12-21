module.exports = {
  env: {
    browser: true,
    es2021: true
  },
  plugins: ["html"],
  overrides: [
    {
      files: ["**/*.html"],
      processor: "html/html"
    }
  ],
  rules: {
    eqeqeq: "warn",
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]
  }
};
