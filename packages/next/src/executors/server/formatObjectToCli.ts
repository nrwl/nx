export function formatObjectToCli(obj: { [key: string]: any }): string {
  return Object.entries(obj)
    .reduce((arr, [key, value]) => {
      if (value !== undefined) {
        const kebabCase = key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
        return `${arr}--${kebabCase}=${value} `;
      } else {
        return arr;
      }
    }, '')
    .trim();
}
