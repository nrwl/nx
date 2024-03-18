export function createCliOptions(
  obj: Record<string, string | number | boolean>
): string[] {
  return Object.entries(obj).reduce((arr, [key, value]) => {
    if (value !== undefined) {
      const kebabCase = key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
      arr.push(`--${kebabCase}=${value}`);
    }
    return arr;
  }, []);
}
