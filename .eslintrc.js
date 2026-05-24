module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'commonjs',
  },
  env: {
    node: true,
    es6: true,
  },
  extends: ['eslint:recommended'],
  rules: {
    // 代码风格
    'indent': ['error', 2, { SwitchCase: 1 }],
    'quotes': ['error', 'single', { avoidEscape: true }],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    
    // 质量
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'no-empty': ['error', { 'allowEmptyCatch': true }],
    
    // 可能的错误
    'eqeqeq': ['error', 'always', { null: 'ignore' }],
    'curly': ['error', 'multi-line'],
    'dot-notation': 'error',
  },
  overrides: [
    {
      files: ['*.test.js'],
      env: {
        mocha: true,
      },
    },
  ],
};
