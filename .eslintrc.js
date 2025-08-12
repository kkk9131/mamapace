module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  env: {
    browser: true,
    es6: true,
    node: true,
    'react-native/react-native': true,
    jest: true,
  },
  extends: [
    'eslint:recommended',
    '@react-native-community',
    '@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react-native/all',
    'plugin:jest/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
  ],
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'react-native',
    'jest',
    'import',
  ],
  rules: {
    // Prevent console usage in production
    'no-console': 'error',
    
    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/prefer-const': 'error',
    
    // React specific rules
    'react/react-in-jsx-scope': 'off', // Not needed in React 17+
    'react/prop-types': 'off', // Using TypeScript for prop validation
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    
    // Import rules
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
        ],
        'newlines-between': 'always',
      },
    ],
    'import/no-unresolved': 'error',
    'import/no-unused-modules': 'warn',
    
    // Code quality rules
    'prefer-const': 'error',
    'no-var': 'error',
    'no-unused-vars': 'off', // Handled by TypeScript
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    
    // Security related rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    
    // Performance rules
    'react-native/no-inline-styles': 'warn',
    'react-native/split-platform-components': 'error',
    
    // Accessibility
    'jsx-a11y/accessible-emoji': 'off', // React Native doesn't support this
  },
  overrides: [
    {
      files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
      env: {
        jest: true,
      },
      rules: {
        // Allow console in test files for debugging
        'no-console': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    {
      files: ['metro.config.js', 'babel.config.js'],
      env: {
        node: true,
      },
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    '.expo/',
    '.expo-shared/',
    'dist/',
    'build/',
    'coverage/',
    '*.config.js',
    '*.json',
  ],
};