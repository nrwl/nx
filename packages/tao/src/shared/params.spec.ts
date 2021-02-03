import { ParsedArgs } from 'minimist';
import {
  coerceTypesInOptions,
  convertAliases,
  convertSmartDefaultsIntoNamedParams,
  convertToCamelCase,
  lookupUnmatched,
  Schema,
  setDefaults,
  validateOptsAgainstSchema,
} from './params';

describe('params', () => {
  describe('coerceTypes', () => {
    it('should handle booleans', () => {
      const opts = coerceTypesInOptions(
        { a: true, b: 'true', c: false, d: 'true' },
        {
          properties: {
            a: { type: 'boolean' },
            b: { type: 'boolean' },
            c: { type: 'boolean' },
            d: { type: 'string' },
          },
        } as Schema
      );

      expect(opts).toEqual({
        a: true,
        b: true,
        c: false,
        d: 'true',
      });
    });

    it('should handle numbers', () => {
      const opts = coerceTypesInOptions({ a: 1, b: '2', c: '3' }, {
        properties: {
          a: { type: 'number' },
          b: { type: 'number' },
          c: { type: 'string' },
        },
      } as Schema);

      expect(opts).toEqual({
        a: 1,
        b: 2,
        c: '3',
      });
    });

    it('should handle arrays', () => {
      const opts = coerceTypesInOptions({ a: 'one,two', b: 'three,four' }, {
        properties: {
          a: { type: 'array' },
          b: { type: 'string' },
        },
      } as Schema);

      expect(opts).toEqual({
        a: ['one', 'two'],
        b: 'three,four',
      });

      const opts2 = coerceTypesInOptions({ a: '1,2', b: 'true,false' }, {
        properties: {
          a: { type: 'array', items: { type: 'number' } },
          b: { type: 'array', items: { type: 'boolean' } },
        },
      } as Schema);

      expect(opts2).toEqual({
        a: [1, 2],
        b: [true, false],
      });
    });

    it('should handle oneOf', () => {
      const opts = coerceTypesInOptions(
        { a: 'false' } as any,
        {
          properties: {
            a: { oneOf: [{ type: 'object' }, { type: 'boolean' }] },
          },
        } as Schema
      );

      expect(opts).toEqual({
        a: false,
      });
    });

    it('should handle oneOf with enums inside', () => {
      const opts = coerceTypesInOptions(
        { inspect: 'inspect' } as any,
        {
          properties: {
            inspect: {
              oneOf: [
                {
                  type: 'string',
                  enum: ['inspect', 'inspect-brk'],
                },
                {
                  type: 'number',
                },
                {
                  type: 'boolean',
                },
              ],
            },
          },
        } as Schema
      );

      expect(opts).toEqual({
        inspect: 'inspect',
      });
    });

    it('should only coerce string values', () => {
      const opts = coerceTypesInOptions(
        { a: true } as any,
        {
          properties: {
            a: { oneOf: [{ type: 'boolean' }, { type: 'number' }] },
          },
        } as Schema
      );

      expect(opts).toEqual({
        a: true,
      });
    });
  });

  describe('convertToCamelCase', () => {
    it('should convert dash case to camel case', () => {
      expect(
        convertToCamelCase({
          _: undefined,
          'one-two': 1,
        } as ParsedArgs)
      ).toEqual({
        oneTwo: 1,
      });
    });

    it('should not convert camel case', () => {
      expect(
        convertToCamelCase({
          _: undefined,
          oneTwo: 1,
        })
      ).toEqual({
        oneTwo: 1,
      });
    });

    it('should handle mixed case', () => {
      expect(
        convertToCamelCase({
          _: undefined,
          'one-Two': 1,
        })
      ).toEqual({
        oneTwo: 1,
      });
    });
  });

  describe('convertAliases', () => {
    it('should replace aliases with actual keys', () => {
      expect(
        convertAliases(
          { d: 'test' },
          {
            properties: { directory: { type: 'string', alias: 'd' } },
            required: [],
            description: '',
          },
          true
        )
      ).toEqual({ directory: 'test' });
    });

    it('should filter unknown keys into the leftovers field when excludeUnmatched is true', () => {
      expect(
        convertAliases(
          { d: 'test' },
          {
            properties: { directory: { type: 'string' } },
            required: [],
            description: '',
          },
          true
        )
      ).toEqual({
        '--': [
          {
            name: 'd',
            possible: [],
          },
        ],
      });
    });

    it('should not filter unknown keys into the leftovers field when excludeUnmatched is false', () => {
      expect(
        convertAliases(
          { d: 'test' },
          {
            properties: { directory: { type: 'string' } },
            required: [],
            description: '',
          },
          false
        )
      ).toEqual({
        d: 'test',
      });
    });
  });

  describe('lookupUnmatched', () => {
    it('should populate the possible array with near matches', () => {
      expect(
        lookupUnmatched(
          {
            '--': [
              {
                name: 'directoy',
                possible: [],
              },
            ],
          },
          {
            properties: { directory: { type: 'string' } },
            required: [],
            description: '',
          }
        )
      ).toEqual({
        '--': [
          {
            name: 'directoy',
            possible: ['directory'],
          },
        ],
      });
    });

    it('should NOT populate the possible array with far matches', () => {
      expect(
        lookupUnmatched(
          {
            '--': [
              {
                name: 'directoy',
                possible: [],
              },
            ],
          },
          {
            properties: { faraway: { type: 'string' } },
            required: [],
            description: '',
          }
        )
      ).toEqual({
        '--': [
          {
            name: 'directoy',
            possible: [],
          },
        ],
      });
    });
  });

  describe('setDefault', () => {
    it('should set default values', () => {
      const opts = setDefaults(
        { c: false },
        {
          properties: {
            a: {
              type: 'boolean',
            },
            b: {
              type: 'boolean',
              default: true,
            },
            c: {
              type: 'boolean',
              default: true,
            },
          },
        }
      );

      expect(opts).toEqual({ b: true, c: false });
    });

    it('should set defaults in complex cases', () => {
      const opts = setDefaults(
        { a: [{}, {}] },
        {
          properties: {
            a: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: {
                    type: 'string',
                    default: 'inner',
                  },
                },
              },
            },
          },
        }
      );

      expect(opts).toEqual({ a: [{ key: 'inner' }, { key: 'inner' }] });
    });

    it('should set the default array value', () => {
      const opts = setDefaults(
        {},
        {
          properties: {
            a: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: {
                    type: 'string',
                    default: 'inner',
                  },
                },
              },
              default: [],
            },
          },
        }
      );

      expect(opts).toEqual({ a: [] });
    });

    it('should resolve types using refs', () => {
      const opts = setDefaults(
        {},
        {
          properties: {
            a: {
              $ref: '#/definitions/a',
            },
          },
          definitions: {
            a: {
              type: 'boolean',
              default: true,
            },
          },
        }
      );

      expect(opts).toEqual({ a: true });
    });
  });

  describe('convertSmartDefaultsIntoNamedParams', () => {
    it('should use argv', () => {
      const params = {};
      convertSmartDefaultsIntoNamedParams(
        params,
        {
          properties: {
            a: {
              type: 'string',
              $default: {
                $source: 'argv',
                index: 0,
              },
            },
          },
        },
        ['argv-value'],
        null,
        null
      );

      expect(params).toEqual({ a: 'argv-value' });
    });

    it('should use projectName', () => {
      const params = {};
      convertSmartDefaultsIntoNamedParams(
        params,
        {
          properties: {
            a: {
              type: 'string',
              $default: {
                $source: 'projectName',
              },
            },
          },
        },
        [],
        'myProject',
        null
      );

      expect(params).toEqual({ a: 'myProject' });
    });

    it('should use relativeCwd to set path', () => {
      const params = {};
      convertSmartDefaultsIntoNamedParams(
        params,
        {
          properties: {
            a: {
              type: 'string',
              format: 'path',
              visible: false,
            },
          },
        },
        [],
        null,
        './somepath'
      );

      expect(params).toEqual({ a: './somepath' });
    });
  });

  describe('validateOptsAgainstSchema', () => {
    it('should throw if missing the required property', () => {
      expect(() =>
        validateOptsAgainstSchema(
          {},
          {
            properties: {
              a: {
                type: 'boolean',
              },
            },
            required: ['a'],
          }
        )
      ).toThrow("Required property 'a' is missing");
    });

    it('should throw if found an unknown property', () => {
      expect(() =>
        validateOptsAgainstSchema(
          {
            a: true,
            b: false,
          },
          {
            properties: {
              a: {
                type: 'boolean',
              },
            },
            additionalProperties: false,
          }
        )
      ).toThrow("'b' is not found in schema");
    });

    it("should throw if the type doesn't match (primitive types)", () => {
      expect(() =>
        validateOptsAgainstSchema(
          { a: 'string' },
          {
            properties: {
              a: {
                type: 'boolean',
              },
            },
          }
        )
      ).toThrow(
        "Property 'a' does not match the schema. 'string' should be a 'boolean'."
      );
    });

    it('should not throw if the schema type is absent (primitive types)', () => {
      expect(() =>
        validateOptsAgainstSchema(
          { a: 'string' },
          {
            properties: {
              a: {
                default: false,
              },
            },
          }
        )
      ).not.toThrow();
    });

    it('should handle one of', () => {
      expect(() =>
        validateOptsAgainstSchema(
          { a: 'string' },
          {
            properties: {
              a: {
                oneOf: [
                  {
                    type: 'string',
                  },
                  {
                    type: 'boolean',
                  },
                ],
              },
            },
          }
        )
      ).not.toThrow();
    });

    it('should handle oneOf with factorized type', () => {
      expect(() =>
        validateOptsAgainstSchema(
          { a: 10 },
          {
            properties: {
              a: {
                type: 'number',
                oneOf: [{ multipleOf: 5 }, { multipleOf: 3 }],
              },
            },
          }
        )
      ).not.toThrow();
    });

    it('should handle oneOf properties explicit types', () => {
      expect(() =>
        validateOptsAgainstSchema(
          { a: true },
          {
            properties: {
              a: {
                type: 'number',
                oneOf: [{ type: 'string' }, { type: 'boolean' }],
              },
            },
          }
        )
      ).not.toThrow();
    });

    it('should handle oneOf properties with enums', () => {
      // matching enum value
      expect(() =>
        validateOptsAgainstSchema(
          { a: 'inspect' },
          {
            properties: {
              a: {
                oneOf: [
                  {
                    type: 'string',
                    enum: ['inspect', 'inspect-brk'],
                  },
                  {
                    type: 'boolean',
                  },
                ],
              },
            },
          }
        )
      ).not.toThrow();

      // matching oneOf value
      expect(() =>
        validateOptsAgainstSchema(
          { a: true },
          {
            properties: {
              a: {
                oneOf: [
                  {
                    type: 'string',
                    enum: ['inspect', 'inspect-brk'],
                  },
                  {
                    type: 'boolean',
                  },
                ],
              },
            },
          }
        )
      ).not.toThrow();

      // non-matching enum value
      expect(() =>
        validateOptsAgainstSchema(
          { a: 'abc' },
          {
            properties: {
              a: {
                oneOf: [
                  {
                    type: 'string',
                    enum: ['inspect', 'inspect-brk'],
                  },
                  {
                    type: 'boolean',
                  },
                ],
              },
            },
          }
        )
      ).toThrow();
    });

    it("should throw if the type doesn't match (arrays)", () => {
      expect(() =>
        validateOptsAgainstSchema(
          { a: ['string', 123] },
          {
            properties: {
              a: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
            },
          }
        )
      ).toThrow(
        "Property 'a' does not match the schema. '123' should be a 'string'."
      );
    });

    it("should throw if the type doesn't match (objects)", () => {
      expect(() =>
        validateOptsAgainstSchema(
          { a: { key: 'string' } },
          {
            properties: {
              a: {
                type: 'object',
                properties: {
                  key: {
                    type: 'boolean',
                  },
                },
              },
            },
          }
        )
      ).toThrow(
        "Property 'key' does not match the schema. 'string' should be a 'boolean'."
      );
    });

    it('should resolve types using refs', () => {
      expect(() =>
        validateOptsAgainstSchema(
          { key: 'string' },
          {
            properties: {
              key: {
                $ref: '#/definitions/key',
              },
            },
            definitions: {
              key: {
                type: 'boolean',
              },
            },
          }
        )
      ).toThrow(
        "Property 'key' does not match the schema. 'string' should be a 'boolean'."
      );
    });
  });
});
