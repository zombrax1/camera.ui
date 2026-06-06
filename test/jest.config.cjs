module.exports = {
  verbose: true,
  rootDir: './',
  transform: {},
  coveragePathIgnorePatterns: ['test.js'],
  moduleNameMapper: {
    '^entities$': '<rootDir>/../node_modules/htmlparser2/node_modules/entities/dist/commonjs/index.js',
    '^entities/(.*)$': '<rootDir>/../node_modules/htmlparser2/node_modules/entities/dist/commonjs/$1.js',
    '^htmlparser2$': '<rootDir>/../node_modules/htmlparser2/dist/commonjs/index.js',
    '^htmlparser2/WritableStream$': '<rootDir>/../node_modules/htmlparser2/dist/commonjs/WritableStream.js',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['./setup.js'],
  testTimeout: 30000,
  testEnvironment: 'jest-environment-node',
  //testRunner: '../node_modules/jest-jasmine2/build/index',
};
