// @ts-check

/** @type {import("@commitlint/types").UserConfig} */
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Type must be one of these
    "type-enum": [
      2,
      "always",
      [
        "feat",     // New feature
        "fix",      // Bug fix
        "docs",     // Documentation
        "style",    // Code style (formatting, semicolons, etc.)
        "refactor", // Code refactoring
        "perf",     // Performance improvement
        "test",     // Adding/updating tests
        "build",    // Build system or external dependencies
        "ci",       // CI/CD configuration
        "chore",    // Maintenance tasks
        "revert",   // Reverting a commit
        "wip",      // Work in progress
      ],
    ],
    // Subject must not be empty
    "subject-empty": [2, "never"],
    // Subject max length
    "subject-max-length": [2, "always", 100],
    // Type must not be empty
    "type-empty": [2, "never"],
    // Type must be lowercase
    "type-case": [2, "always", "lower-case"],
  },
};

module.exports = config;
