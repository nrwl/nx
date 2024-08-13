import type { Observable } from 'rxjs';
import { first, toArray } from 'rxjs/operators';

/**
 * @deprecated This will be removed in Nx v21. If using RxJS 7, use `firstValueFrom(obs$.pipe(toArray()))`
 * or `lastValueFrom(obs$.pipe(toArray()))`. If using RxJS 6, use `obs$.pipe(toArray()).toPromise()`.
 *
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
  return o.pipe(toArray()).toPromise();
}

/**
 * @deprecated This will be removed in Nx v21. Since RxJS 7, use `firstValueFrom(obs$)`. If using RxJS 6,
 * use `obs$.pipe(first()).toPromise()`.
 *
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
  return o.pipe(first()).toPromise();
}
