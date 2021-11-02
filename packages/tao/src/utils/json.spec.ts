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
    ).toThrowError();
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
    ).toThrowError();
  });
});
