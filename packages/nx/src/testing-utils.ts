import {Observable} from 'rxjs/Observable';
import {first} from 'rxjs/operator/first';
import {toArray} from 'rxjs/operator/toArray';
import {toPromise} from 'rxjs/operator/toPromise';

/**
 * @whatItDoes reads all the values from an observable and returns a promise
 * with an array of all values. This should be used in combination with async/await.
 *
 * ## Example
 *
 * ```typescript
 * const obs = of(1, 2, 3, 4);
 * const res = await readAll(obs)
 * expect(res).toEqual([1, 2, 3, 4]);
 * ```
 */
export function readAll<T>(o: Observable<T>): Promise<T[]> {
  return toPromise.call(toArray.call(o));
}

/**
 * @whatItDoes reads the first value from an observable and returns a promise
 * with it. This should be used in combination with async/await.
 *
 * ## Example
 *
 * ```typescript
 * const obs = of(1, 2, 3, 4);
 * const res = await readFirst(obs)
 * expect(res).toEqual(1);
 * ```
 */
export function readFirst<T>(o: Observable<T>): Promise<T> {
  return toPromise.call(first.call(o));
}
