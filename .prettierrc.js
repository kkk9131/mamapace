module.exports = {
  // Basic formatting
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',
  
  // JSX formatting
  jsxSingleQuote: false,
  jsxBracketSameLine: false,
  
  // Trailing commas
  trailingComma: 'es5',
  
  // Brackets and arrows
  bracketSpacing: true,
  arrowParens: 'avoid',
  
  // End of line
  endOfLine: 'lf',
  
  // Embedded language formatting
  embeddedLanguageFormatting: 'auto',
  
  // React Native specific
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      options: {
        parser: 'typescript',
      },
    },
  ],
};