import * as yargsParser from 'yargs-parser';
import { logger } from './logger';
import {
  applyVerbosity,
  coerceTypesInOptions,
  combineOptionsForExecutor,
  convertAliases,
  convertSmartDefaultsIntoNamedParams,
  convertToCamelCase,
  lookupUnmatched,
  Schema,
  setDefaults,
  validateOptsAgainstSchema,
  warnDeprecations,
} from './params';
import { TargetConfiguration } from '../config/workspace-json-project-json';

describe('params', () => {
  describe('combineOptionsForExecutor', () => {
    let schema: Schema;
    beforeEach(() => {
      schema = {
        properties: {
          overriddenOpt: {
            type: 'string',
            alias: 'overriddenOptAlias',
          },
        },
      };
    });

    it('should use target options', () => {
      const commandLineOpts = {};
      const target: TargetConfiguration = {
        executor: '@nrwl/do:stuff',
        options: {
          overriddenOpt: 'target value',
        },
        configurations: {
          production: {},
        },
      };

      const options = combineOptionsForExecutor(
        commandLineOpts,
        'production',
        target,
        schema,
        'proj',
        process.cwd()
      );

      expect(options).toEqual({
        overriddenOpt: 'target value',
      });
    });

    it('should combine target, configuration', () => {
      const commandLineOpts = {};
      const target: TargetConfiguration = {
        executor: '@nrwl/do:stuff',
        options: {
          overriddenOpt: 'target value',
        },
        configurations: {
          production: {
            overriddenOpt: 'config value',
          },
        },
      };

      const options = combineOptionsForExecutor(
        commandLineOpts,
        'production',
        target,
        schema,
        'proj',
        process.cwd()
      );

      expect(options).toEqual({
        overriddenOpt: 'config value',
      });
    });

    it('should combine target, configuration, and passed options', () => {
      const commandLineOpts = {
        overriddenOpt: 'command value',
      };
      const target: TargetConfiguration = {
        executor: '@nrwl/do:stuff',
        options: {
          overriddenOpt: 'target value',
        },
        configurations: {
          production: {
            overriddenOpt: 'config value',
          },
        },
      };

      const options = combineOptionsForExecutor(
        commandLineOpts,
        'production',
        target,
        schema,
        'proj',
        process.cwd()
      );

      expect(options).toEqual({
        overriddenOpt: 'command value',
      });
    });

    it('should convert aliases in target configuration', () => {
      const commandLineOpts = {
        overriddenOpt: 'command value',
      };
      const target: TargetConfiguration = {
        executor: '@nrwl/do:stuff',
        options: {
          overriddenOptAlias: 'target value',
        },
        configurations: {
          production: {
            overriddenOptAlias: 'config value',
          },
        },
      };

      const options = combineOptionsForExecutor(
        commandLineOpts,
        'production',
        target,
        schema,
        'proj',
        process.cwd()
      );

      expect(options).toEqual({
        overriddenOpt: 'command value',
      });
    });

    it('should convert aliases in command line arguments', () => {
      const commandLineOpts = {
        overriddenOptAlias: 'command value',
      };
      const target: TargetConfiguration = {
        executor: '@nrwl/do:stuff',
        options: {
          overriddenOpt: 'target value',
        },
        configurations: {
          production: {
            overriddenOpt: 'config value',
          },
        },
      };

      const options = combineOptionsForExecutor(
        commandLineOpts,
        'production',
        target,
        schema,
        'proj',
        process.cwd()
      );

      expect(options).toEqual({
        overriddenOpt: 'command value',
      });
    });

    it('should handle targets without options', () => {
      const commandLineOpts = {};
      const target: TargetConfiguration = {
        executor: '@nrwl/do:stuff',
      };

      const options = combineOptionsForExecutor(
        commandLineOpts,
        'production',
        target,
        schema,
        'proj',
        process.cwd()
      );

      expect(options).toEqual({});
    });
  });

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

    it('should handle options with aliases', () => {
      const schema: Schema = {
        properties: {
          name: { type: 'array', alias: 'n' },
        },
      };
      const opts = coerceTypesInOptions({ n: 'one,two' }, schema);

      expect(opts).toEqual({
        n: ['one', 'two'],
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
        convertToCamelCase(
          yargsParser(['--one-two', '1'], {
            number: ['oneTwo'],
          })
        )
      ).toEqual({
        _: [],
        oneTwo: 1,
      });
    });

    it('should not convert camel case', () => {
      expect(
        convertToCamelCase(
          yargsParser(['--oneTwo', '1'], {
            number: ['oneTwo'],
          })
        )
      ).toEqual({
        _: [],
        oneTwo: 1,
      });
    });

    it('should handle mixed case', () => {
      expect(
        convertToCamelCase(
          yargsParser(['--one-Two', '1'], {
            number: ['oneTwo'],
          })
        )
      ).toEqual({
        _: [],
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

    it('should replace aliases defined in aliases with actual keys', () => {
      expect(
        convertAliases(
          { d: 'test' },
          {
            properties: { directory: { type: 'string', aliases: ['d'] } },
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

    it('should set the default object value', () => {
      const opts = setDefaults(
        {
          a: {
            key: 'value',
          },
        },
        {
          properties: {
            a: {
              type: 'object',
              properties: {
                key: {
                  type: 'string',
                },
                key2: {
                  type: 'string',
                  default: 'value2',
                },
              },
            },
          },
        }
      );

      expect(opts).toEqual({ a: { key: 'value', key2: 'value2' } });
    });

    it('should not default object properties to {}', () => {
      const opts = setDefaults(
        {},
        {
          properties: {
            a: {
              type: 'object',
              properties: {
                key: {
                  type: 'string',
                },
              },
            },
          },
        }
      );

      expect(opts).toEqual({});
    });

    it('should be able to set defaults for underlying properties', () => {
      const opts = setDefaults(
        {},
        {
          properties: {
            a: {
              type: 'object',
              properties: {
                minify: {
                  type: 'boolean',
                  default: true,
                },
                inlineCritical: {
                  type: 'boolean',
                  default: true,
                },
              },
              additionalProperties: false,
            },
          },
        }
      );

      expect(opts).toEqual({
        a: {
          minify: true,
          inlineCritical: true,
        },
      });
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

    describe('primitive types', () => {
      it("should throw if the type doesn't match", () => {
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

      it('should not throw if the schema type is absent', () => {
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

      describe('array', () => {
        it('should handle validating patterns', () => {
          const schema = {
            properties: {
              a: {
                type: ['string', 'boolean'],
              },
            },
          };
          expect(() =>
            validateOptsAgainstSchema({ a: 'abc' }, schema)
          ).not.toThrow();
          expect(() =>
            validateOptsAgainstSchema({ a: true }, schema)
          ).not.toThrow();
          expect(() =>
            validateOptsAgainstSchema({ a: 123 }, schema)
          ).toThrowErrorMatchingInlineSnapshot(
            `"Property 'a' does not match the schema. '123' should be a 'string,boolean'."`
          );
        });
      });

      describe('string', () => {
        it('should handle validating patterns', () => {
          const schema = {
            properties: {
              a: {
                type: 'string',
                pattern: '^a',
              },
            },
          };
          expect(() =>
            validateOptsAgainstSchema({ a: 'abc' }, schema)
          ).not.toThrow();
          expect(() =>
            validateOptsAgainstSchema({ a: 'xyz' }, schema)
          ).toThrowErrorMatchingInlineSnapshot(
            `"Property 'a' does not match the schema. 'xyz' should match the pattern '^a'."`
          );
        });

        it('should handle validating minLength', () => {
          const schema = {
            properties: {
              a: {
                type: 'string',
                minLength: 2,
              },
            },
          };
          expect(() =>
            validateOptsAgainstSchema({ a: 'a' }, schema)
          ).toThrowErrorMatchingInlineSnapshot(
            `"Property 'a' does not match the schema. 'a' (1 character(s)) should have at least 2 character(s)."`
          );
          expect(() =>
            validateOptsAgainstSchema({ a: 'abc' }, schema)
          ).not.toThrow();
        });
        it('should handle validating maxLength', () => {
          const schema = {
            properties: {
              a: {
                type: 'string',
                pattern: '^a',
              },
            },
          };
          expect(() =>
            validateOptsAgainstSchema({ a: 'abc' }, schema)
          ).not.toThrow();
          expect(() =>
            validateOptsAgainstSchema({ a: 'xyz' }, schema)
          ).toThrowErrorMatchingInlineSnapshot(
            `"Property 'a' does not match the schema. 'xyz' should match the pattern '^a'."`
          );
        });
      });

      describe('number', () => {
        it('should handle validating multiples of', () => {
          const schema = {
            properties: {
              a: {
                type: 'number',
                multipleOf: 3,
              },
            },
          };
          expect(() =>
            validateOptsAgainstSchema({ a: 6 }, schema)
          ).not.toThrow();
          expect(() =>
            validateOptsAgainstSchema({ a: 5 }, schema)
          ).toThrowErrorMatchingInlineSnapshot(
            `"Property 'a' does not match the schema. 5 should be a multiple of 3."`
          );
        });

        it('should handle validating minimum', () => {
          const schema = {
            properties: {
              a: {
                type: 'number',
                minimum: 3,
              },
            },
          };
          expect(() =>
            validateOptsAgainstSchema({ a: 2 }, schema)
          ).toThrowErrorMatchingInlineSnapshot(
            `"Property 'a' does not match the schema. 2 should be at least 3"`
          );
          expect(() =>
            validateOptsAgainstSchema({ a: 3 }, schema)
          ).not.toThrow();
          expect(() =>
            validateOptsAgainstSchema({ a: 4 }, schema)
          ).not.toThrow();
        });

        it('should handle validating exclusive minimum', () => {
          const schema = {
            properties: {
              a: {
                type: 'number',
                exclusiveMinimum: 3,
              },
            },
          };
          expect(() =>
            validateOptsAgainstSchema({ a: 2 }, schema)
          ).toThrowErrorMatchingInlineSnapshot(
            `"Property 'a' does not match the schema. 2 should be greater than 3"`
          );
          expect(() =>
            validateOptsAgainstSchema({ a: 3 }, schema)
          ).toThrowErrorMatchingInlineSnapshot(
            `"Property 'a' does not match the schema. 3 should be greater than 3"`
          );
          expect(() =>
            validateOptsAgainstSchema({ a: 4 }, schema)
          ).not.toThrow();
        });

        it('should handle validating maximum', () => {
          const schema = {
            properties: {
              a: {
                type: 'number',
                maximum: 3,
              },
            },
          };
          expect(() =>
            validateOptsAgainstSchema({ a: 2 }, schema)
          ).not.toThrow();
          expect(() =>
            validateOptsAgainstSchema({ a: 3 }, schema)
          ).not.toThrow();
          expect(() =>
            validateOptsAgainstSchema({ a: 4 }, schema)
          ).toThrowErrorMatchingInlineSnapshot(
            `"Property 'a' does not match the schema. 4 should be at most 3"`
          );
        });

        it('should handle vavlidating exclusive maximum', () => {
          const schema = {
            properties: {
              a: {
                type: 'number',
                exclusiveMaximum: 3,
              },
            },
          };
          expect(() =>
            validateOptsAgainstSchema({ a: 2 }, schema)
          ).not.toThrow();
          expect(() =>
            validateOptsAgainstSchema({ a: 3 }, schema)
          ).toThrowErrorMatchingInlineSnapshot(
            `"Property 'a' does not match the schema. 3 should be less than 3"`
          );
          expect(() =>
            validateOptsAgainstSchema({ a: 4 }, schema)
          ).toThrowErrorMatchingInlineSnapshot(
            `"Property 'a' does not match the schema. 4 should be less than 3"`
          );
        });
      });
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
      const schema = {
        properties: {
          a: {
            type: 'number',
            oneOf: [{ multipleOf: 5 }, { multipleOf: 3 }],
          },
        },
      };
      expect(() => validateOptsAgainstSchema({ a: 10 }, schema)).not.toThrow();
      expect(() => validateOptsAgainstSchema({ a: 15 }, schema)).toThrow();
    });

    it('should handle anyOf', () => {
      const schema = {
        properties: {
          a: {
            type: 'number',
            anyOf: [{ multipleOf: 5 }, { multipleOf: 3 }],
          },
        },
      };
      expect(() => validateOptsAgainstSchema({ a: 4 }, schema)).toThrow();
      expect(() => validateOptsAgainstSchema({ a: 10 }, schema)).not.toThrow();
      expect(() => validateOptsAgainstSchema({ a: 15 }, schema)).not.toThrow();
    });

    it('should handle all of', () => {
      const schema = {
        properties: {
          a: {
            type: 'number',
            allOf: [{ multipleOf: 5 }, { multipleOf: 3 }],
          },
        },
      };
      expect(() => validateOptsAgainstSchema({ a: 4 }, schema)).toThrow();
      expect(() => validateOptsAgainstSchema({ a: 10 }, schema)).toThrow();
      expect(() => validateOptsAgainstSchema({ a: 15 }, schema)).not.toThrow();
    });

    it('should handle one of with string lengths', () => {
      expect(() =>
        validateOptsAgainstSchema(
          { a: 'nrwl' },
          {
            properties: {
              a: {
                type: 'string',
                oneOf: [
                  {
                    maxLength: 0,
                  },
                  {
                    minLength: 1,
                  },
                ],
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

  describe('warnDeprecations', () => {
    beforeEach(() => {
      jest.spyOn(logger, 'warn').mockImplementation(() => {});
    });

    it('should not log a warning when an option marked as deprecated is not specified', () => {
      warnDeprecations(
        { b: true },
        {
          properties: {
            a: {
              type: 'boolean',
              'x-deprecated': true,
            },
            b: {
              type: 'boolean',
            },
          },
        }
      );

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should log a warning when an option marked as deprecated is specified', () => {
      warnDeprecations(
        { a: true },
        {
          properties: {
            a: {
              type: 'boolean',
              'x-deprecated': true,
            },
          },
        }
      );

      expect(logger.warn).toHaveBeenCalledWith('Option "a" is deprecated.');
    });

    it('should log a warning with the deprecation notice when x-deprecated is a string', () => {
      warnDeprecations(
        { a: true },
        {
          properties: {
            a: {
              type: 'boolean',
              'x-deprecated':
                'Deprecated since version x.x.x. Use "b" instead.',
            },
          },
        }
      );

      expect(logger.warn).toHaveBeenCalledWith(
        'Option "a" is deprecated: Deprecated since version x.x.x. Use "b" instead.'
      );
    });
  });

  describe('applyVerbosity', () => {
    const isVerbose = true;

    it('should not apply verbose if additionalProperties is false and verbose is not in schema', () => {
      const options = {};
      applyVerbosity(
        options,
        { additionalProperties: false, properties: {} },
        isVerbose
      );

      expect(options).toEqual({});
    });

    it('should apply verbose if additionalProperties is true and isVerbose is truthy', () => {
      const options = {};
      applyVerbosity(
        options,
        { additionalProperties: true, properties: {} },
        isVerbose
      );
      expect(options).toEqual({ verbose: isVerbose });
    });

    it('should apply verbose if additionalProperties is false but verbose is in schema and isVerbose  is truthy', () => {
      const options = {};
      applyVerbosity(
        options,
        {
          additionalProperties: false,
          properties: { verbose: {} },
        },
        isVerbose
      );
      expect(options).toEqual({ verbose: isVerbose });
    });

    it('should not apply verbose if isVerbose is falsy', () => {
      const options = {};
      applyVerbosity(
        options,
        {
          additionalProperties: false,
          properties: { verbose: {} },
        },
        false
      );
      expect(options).toEqual({});
    });
  });
});
