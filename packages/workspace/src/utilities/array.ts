/**
 * Appends an array to another array.
 *
 * Using `array.push(...otherArray)` can cause the stack to overflow when
 * the `otherArray` is very large. This happens because the spread operator
 * allocates every item in the stack before pushing them to the source array.
 *
 * The solution is to iterate over each element and append it. It is tedious
 * to repeat this everywhere, so this is a small utility to help with that.
 *
 * Note: this mutates the source array. For an immutable operation, use
 * `Array.prototype.concat` or `[...source, ...otherArray]`.
 *
 * @param source The array to append to.
 * @param arrayToAppend The array to append to the source array.
 */
export function appendArray<T>(source: T[], arrayToAppend: T[]) {
  for (const item of arrayToAppend) {
    source.push(item);
  }
}
