declare module 'tcp-port-used' {
  export function check(port: number, host?: string): Promise<boolean>;
}
