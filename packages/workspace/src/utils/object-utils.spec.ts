import { sortObject } from './object-utils';

describe('object-utils', () => {
  describe('sortObject', () => {
    it('should sort an object with one level of strings', () => {
      const obj: Record<string, string> = {
        c: '2',
        g: '5',
        a: '',
        z: '3',
      };
      expect(sortObject(obj)).toEqual({
        a: '',
        c: '2',
        g: '5',
        z: '3',
      });
    });

    it('should sort an object with two levels of strings', () => {
      const obj: Record<string, any> = {
        c: '2',
        g: '5',
        a: '',
        z: '3',
        b: {
          b: '5',
          a: '4',
        },
      };
      expect(sortObject(obj)).toEqual({
        a: '',
        b: {
          a: '4',
          b: '5',
        },
        c: '2',
        g: '5',
        z: '3',
      });
    });

    it('should sort an object with two levels of strings and arrays', () => {
      const obj: Record<string, any> = {
        c: '2',
        g: '5',
        a: '',
        z: '3',
        b: {
          b: '5',
          a: '4',
        },
        d: {
          b: ['b', 'a'],
        },
      };
      expect(sortObject(obj)).toEqual({
        a: '',
        b: {
          a: '4',
          b: '5',
        },
        c: '2',
        d: {
          b: ['a', 'b'],
        },
        g: '5',
        z: '3',
      });
    });
  });
});
