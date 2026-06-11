import { Observable } from 'rxjs';
export declare class Deferred<T> {
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
    promise: Promise<T>;
}
/**
 * Will subscribe to the `source` observable provided,
 *
 * Allowing a `for await..of` loop to iterate over every
 * value that the source emits.
 *
 * **WARNING**: If the async loop is slower than the observable
 * producing values, the values will build up in a buffer
 * and you could experience an out of memory error.
 *
 * This is a lossless subscription method. No value
 * will be missed or duplicated.
 *
 * Example usage:
 *
 * ```ts
 * async function test() {
 *   const source$ = getSomeObservable();
 *
 *   for await(const value of eachValueFrom(source$)) {
 *     console.log(value);
 *   }
 * }
 * ```
 *
 * @param source the Observable source to await values from
 */
export declare function eachValueFrom<T>(source: Observable<T>): AsyncIterableIterator<T>;
/**
 * Will subscribe to the `source` observable provided
 * and build the emitted values up in a buffer. Allowing
 * `for await..of` loops to iterate and get the buffer
 * on each loop.
 *
 * This is a lossless subscription method. No value
 * will be missed or duplicated.
 *
 * Example usage:
 *
 * ```ts
 * async function test() {
 *   const source$ = getSomeObservable();
 *
 *   for await(const buffer of bufferedValuesFrom(source$)) {
 *     for (const value of buffer) {
 *       console.log(value);
 *     }
 *   }
 * }
 * ```
 *
 * @param source the Observable source to await values from
 */
export declare function bufferedValuesFrom<T>(source: Observable<T>): AsyncGenerator<any, void, unknown>;
/**
 * Will subscribe to the provided `source` observable,
 * allowing `for await..of` loops to iterate and get the
 * most recent value that was emitted. Will not iterate out
 * the same emission twice.
 *
 * This is a lossy subscription method. Do not use if
 * every value is important.
 *
 * Example usage:
 *
 * ```ts
 * async function test() {
 *   const source$ = getSomeObservable();
 *
 *   for await(const value of latestValueFrom(source$)) {
 *     console.log(value);
 *   }
 * }
 * ```
 *
 * @param source the Observable source to await values from
 */
export declare function latestValueFrom<T>(source: Observable<T>): AsyncGenerator<any, void, unknown>;
/**
 * Subscribes to the provided `source` observable and allows
 * `for await..of` loops to iterate over it, such that
 * all values are dropped until the iteration occurs, then
 * the very next value that arrives is provided to the
 * `for await` loop.
 *
 * This is a lossy subscription method. Do not use if
 * every value is important.
 *
 * Example usage:
 *
 * ```ts
 * async function test() {
 *   const source$ = getSomeObservable();
 *
 *   for await(const value of nextValueFrom(source$)) {
 *     console.log(value);
 *   }
 * }
 * ```
 *
 * @param source the Observable source to await values from
 */
export declare function nextValueFrom<T>(source: Observable<T>): AsyncGenerator<T, void, void>;
