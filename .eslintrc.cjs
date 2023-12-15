module.exports = {
  overrides: [
    {
      files: ["**.cjs"],
      env: {
        node: true,
      },
    },
  ],
  extends: "@remix-run/eslint-config",
};
