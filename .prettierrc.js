module.exports = {
  overrides: [
    {
      files: "*.ts",
      options: {
        printWidth: 160,
        tabWidth: 2,
        semi: true,
        trailingComma: "es5",
      },
    },
    {
      files: "*.sol",
      options: {
        printWidth: 160,
        tabWidth: 2,
        useTabs: false,
        singleQuote: false,
        bracketSpacing: false,
        explicitTypes: "always",
      },
    },
  ],
};
