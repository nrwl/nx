export interface Schema {
  appName: string;
  mfeType: 'host' | 'remote';
  port?: number;
  remotes?: string[];
  host?: string;
  skipFormat?: boolean;
}
