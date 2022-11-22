/**
 * Simple sort function to ensure keys are ordered alphabetically
 * @param obj
 * @returns
 */
export function sortObject<T = string>(
  obj: Record<string, T>,
  valueTransformator: (value: T) => any = (value) => value,
  descending = false,
  sortFunction?: (a: string, b: string) => number
): Record<string, T> | undefined {
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    return;
  }
  keys.sort(sortFunction);
  if (descending) {
    keys.reverse();
  }
  const result: Record<string, T> = {};
  keys.forEach((key) => {
    result[key] = valueTransformator(obj[key]);
  });
  return result;
}
