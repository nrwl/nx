import { parseJson } from './json';

describe('parseJson', () => {
  it('should parse JSON', () => {
    const parsed = parseJson(`{
        "test": 123,
        "nested": {
            "test": 123,
            "nx": "workspace"
        },
        "array": [1, 2, 3]
    }`);

    expect(parsed).toEqual({
      test: 123,
      nested: {
        test: 123,
        nx: 'workspace',
      },
      array: [1, 2, 3],
    });
  });

  it('should parse JSON with comments', () => {
    const parsed = parseJson(`{
        //"test": 123,
        "nested": {
            "test": 123
            /*
            This should not be parsed
            "nx": "workspace"
            */
        },
        "array": [1, 2, 3]
    }`);

    expect(parsed).toEqual({
      nested: {
        test: 123,
      },
      array: [1, 2, 3],
    });
  });

  it('should throw when JSON with comments gets parsed and disallow comments is true', () => {
    expect(() =>
      parseJson(
        `{
      //"test": 123,
      "nested": {
          "test": 123
          /*
          This should not be parsed
          "nx": "workspace"
          */
      },
      "array": [1, 2, 3]
  }`,
        { disallowComments: true }
      )
    ).toThrowErrorMatchingInlineSnapshot(`
      "InvalidCommentToken in JSON at 2:7
      1: {
      2:       //\\"test\\": 123,
               ^^^^^^^^^^^^^^ InvalidCommentToken
      3:       \\"nested\\": {
      4:           \\"test\\": 123
      5:           /*
      ...
      "
    `);
  });

  it('should throw when JSON with comments gets parsed and disallowComments and expectComments is true', () => {
    expect(() =>
      parseJson(
        `{
      //"test": 123,
      "nested": {
          "test": 123
          /*
          This should not be parsed
          "nx": "workspace"
          */
      },
      "array": [1, 2, 3]
  }`,
        { disallowComments: true, expectComments: true }
      )
    ).toThrowErrorMatchingInlineSnapshot(`
      "InvalidCommentToken in JSON at 2:7
      1: {
      2:       //\\"test\\": 123,
               ^^^^^^^^^^^^^^ InvalidCommentToken
      3:       \\"nested\\": {
      4:           \\"test\\": 123
      5:           /*
      ...
      "
    `);
  });

  it('should allow trailing commas by default', () => {
    expect(() =>
      parseJson(
        `{
      "test": 123,
      "nested": {
          "test": 123,
          "more": 456,
     },
      "array": [1, 2, 3,]
  }`
      )
    ).not.toThrow();
  });

  it('should throw when JSON has trailing commas if disabled', () => {
    expect(() =>
      parseJson(
        `{
      "test": 123,
      "nested": {
          "test": 123,
          "more": 456,
     },
      "array": [1, 2, 3,]
  }`,
        { allowTrailingComma: false }
      )
    ).toThrowErrorMatchingInlineSnapshot(`
      "PropertyNameExpected in JSON at 6:6
      ...
      3:       \\"nested\\": {
      4:           \\"test\\": 123,
      5:           \\"more\\": 456,
      6:      },
              ^ PropertyNameExpected
      7:       \\"array\\": [1, 2, 3,]
      8:   }
      "
    `);
  });

  it('should handle trailing commas', () => {
    expect(
      parseJson(
        `{
      "nested": {
          "test": 123,
      },
      "array": [1, 2, 3,]
  }`,
        { allowTrailingComma: true }
      )
    ).toEqual({
      nested: { test: 123 },
      array: [1, 2, 3],
    });
  });
});
