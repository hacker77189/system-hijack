module.exports = {
    env: {
        node: true,
        es2022: true
    },
    extends: ["eslint:recommended"],
    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "script"
    },
    rules: {
        "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
        "no-var": "error",
        "prefer-const": "warn",
        "no-console": "off",
        "no-control-regex": "off",
        "no-empty": ["warn", { allowEmptyCatch: true }]
    },
    ignorePatterns: ["node_modules/", "workspace/"]
};
