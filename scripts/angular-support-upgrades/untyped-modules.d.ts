declare module '@zkochan/js-yaml' {
  export function dump(obj: unknown, opts?: Record<string, unknown>): string;
  export function load(str: string): unknown;
}
