import { convertToCamelCase } from './params';

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
});
