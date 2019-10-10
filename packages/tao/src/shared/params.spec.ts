import { convertAliases, convertToCamelCase, lookupUnmatched } from './params';

describe('params', () => {
  describe('convertToCamelCase', () => {
    it('should convert dash case to camel case', () => {
      expect(
        convertToCamelCase({
          'one-two': 1
        })
      ).toEqual({
        oneTwo: 1
      });
    });

    it('should not convert camel case', () => {
      expect(
        convertToCamelCase({
          oneTwo: 1
        })
      ).toEqual({
        oneTwo: 1
      });
    });

    it('should handle mixed case', () => {
      expect(
        convertToCamelCase({
          'one-Two': 1
        })
      ).toEqual({
        oneTwo: 1
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
            description: ''
          }
        )
      ).toEqual({ directory: 'test' });
    });

    it('should filter unknown keys into the leftovers field', () => {
      expect(
        convertAliases(
          { d: 'test' },
          {
            properties: { directory: { type: 'string' } },
            required: [],
            description: ''
          }
        )
      ).toEqual({
        '--': [
          {
            name: 'd',
            possible: []
          }
        ]
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
                possible: []
              }
            ]
          },
          {
            properties: { directory: { type: 'string' } },
            required: [],
            description: ''
          }
        )
      ).toEqual({
        '--': [
          {
            name: 'directoy',
            possible: ['directory']
          }
        ]
      });
    });

    it('should NOT populate the possible array with far matches', () => {
      expect(
        lookupUnmatched(
          {
            '--': [
              {
                name: 'directoy',
                possible: []
              }
            ]
          },
          {
            properties: { faraway: { type: 'string' } },
            required: [],
            description: ''
          }
        )
      ).toEqual({
        '--': [
          {
            name: 'directoy',
            possible: []
          }
        ]
      });
    });
  });
});
