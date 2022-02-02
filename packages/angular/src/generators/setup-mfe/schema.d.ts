export interface Schema {
  appName: string;
  mfeType: 'host' | 'remote';
  port?: number;
  remotes?: string[];
  host?: string;
  routing?: boolean;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
}
