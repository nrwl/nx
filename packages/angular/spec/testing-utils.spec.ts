import { from } from 'rxjs';
import { readAll, readFirst } from '../testing/src/testing-utils';

describe('TestingUtils', () => {
  describe('readAll', () => {
    it('should transform Observable<T> to Promise<Array<T>>', async () => {
      const obs = from([1, 2, 3]);
      const result = await readAll(obs);

      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('readFirst', () => {
    it('should transform first item emitted from Observable<T> to Promise<T>', async () => {
      const obs = from([1, 2, 3]);
      const result = await readFirst(obs);

      expect(result).toBe(1);
    });
  });
});
