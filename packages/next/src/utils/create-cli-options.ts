export function createCliOptions(
  obj: Record<string, string | number | boolean>
): string[] {
  return Object.entries(obj).reduce((arr, [key, value]) => {
    if (value !== undefined) {
      arr.push(`--${key}=${value}`);
    }
    return arr;
  }, []);
}
