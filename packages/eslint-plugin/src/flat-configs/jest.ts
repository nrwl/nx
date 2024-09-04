export default [
  {
    languageOptions: {
      // Taken from: https://github.com/jest-community/eslint-plugin-jest/blob/a0e2bc5/src/globals.json
      globals: {
        afterAll: false,
        afterEach: false,
        beforeAll: false,
        beforeEach: false,
        describe: false,
        expect: false,
        fit: false,
        it: false,
        jest: false,
        test: false,
        xdescribe: false,
        xit: false,
        xtest: false,
      },
    },
  },
];
