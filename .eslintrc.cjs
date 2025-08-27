module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
    browser: true,
  },
  globals: {
    TextDecoder: 'readonly',
    TextEncoder: 'readonly',
    fetch: 'readonly',
    Headers: 'readonly',
    Request: 'readonly',
    Response: 'readonly',
    ReadableStream: 'readonly',
    AbortController: 'readonly'
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  extends: [
    'eslint:recommended'
  ],
  rules: {
    'no-console': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-undef': 'error'
  }
};
