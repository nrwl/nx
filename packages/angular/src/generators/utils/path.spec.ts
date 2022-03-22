import { pathStartsWith } from './path';

describe('path helpers', () => {
  describe('pathStartsWith', () => {
    it('should return true, regardless of OS path type', () => {
      expect(pathStartsWith(`./lib1/src/app`, `lib1\\src\\app`)).toBeTruthy();
    });

    it('should return false, regardless of OS path type, when path is wrong', () => {
      expect(pathStartsWith(`./lib1/src/app`, `app1\\src\\app`)).toBeFalsy();
    });

    it('should return true regardless if path has relative path chars', () => {
      expect(pathStartsWith(`lib1/src/app`, `./lib1/src/app`)).toBeTruthy();
    });
  });
});
