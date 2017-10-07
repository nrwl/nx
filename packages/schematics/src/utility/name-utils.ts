export function names(name: string): any {
  return {
    name,
    className: toClassName(name),
    propertyName: toPropertyName(name),
    fileName: toFileName(name)
  };
}

export function toClassName(str: string): string {
  return toCapitalCase(toPropertyName(str));
}

export function toPropertyName(s: string): string {
  return s
    .replace(/(-|_|\.|\s)+(.)?/g, (_, __, chr) => (chr ? chr.toUpperCase() : ''))
    .replace(/^([A-Z])/, m => m.toLowerCase());
}

export function toFileName(s: string): string {
  return s
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[ _]/g, '-');
}

function toCapitalCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.substr(1);
}
