import { ParsedArgs } from 'minimist';
import {
  coerceTypesInOptions,
  convertAliases,
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
        },
        []
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
        },
        []
      );

      expect(opts).toEqual({ a: [{ key: 'inner' }, { key: 'inner' }] });
    });

    it('should set defaults from argv', () => {
      const opts = setDefaults(
        {},
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
        ['argv-value']
      );

      expect(opts).toEqual({ a: 'argv-value' });
    });
  });

  describe('validateOptsAgainstSchema', () => {
    it('should throw if missing the required field', () => {
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
  });
});
