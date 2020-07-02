import {
  coerceTypes,
  convertAliases,
  convertToCamelCase,
  lookupUnmatched,
} from './params';

describe('params', () => {
  describe('coerceTypes', () => {
    it('should handle booleans', () => {
      const opts = coerceTypes({ a: true, b: 'true', c: false, d: 'true' }, {
        properties: {
          a: { type: 'boolean' },
          b: { type: 'boolean' },
          c: { type: 'boolean' },
          d: { type: 'string' },
        },
      } as any);

      expect(opts).toEqual({
        a: true,
        b: true,
        c: false,
        d: 'true',
      });
    });

    it('should handle numbers', () => {
      const opts = coerceTypes({ a: 1, b: '2', c: '3' }, {
        properties: {
          a: { type: 'number' },
          b: { type: 'number' },
          c: { type: 'string' },
        },
      } as any);

      expect(opts).toEqual({
        a: 1,
        b: 2,
        c: '3',
      });
    });

    it('should handle arrays', () => {
      const opts = coerceTypes({ a: 'one,two', b: 'three,four' }, {
        properties: {
          a: { type: 'array' },
          b: { type: 'string' },
        },
      } as any);

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
          'one-two': 1,
        })
      ).toEqual({
        oneTwo: 1,
      });
    });

    it('should not convert camel case', () => {
      expect(
        convertToCamelCase({
          oneTwo: 1,
        })
      ).toEqual({
        oneTwo: 1,
      });
    });

    it('should handle mixed case', () => {
      expect(
        convertToCamelCase({
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
});
