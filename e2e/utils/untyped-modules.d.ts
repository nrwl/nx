declare module '@zkochan/js-yaml' {
  export function dump(obj: unknown, opts?: Record<string, unknown>): string;
  export function load(str: string, opts?: Record<string, unknown>): unknown;
}

declare module 'tcp-port-used' {
  export function check(port: number, host?: string): Promise<boolean>;
}
