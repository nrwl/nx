export interface Schema {
  appName: string;
  mfType: 'host' | 'remote';
  port?: number;
  remotes?: string[];
  host?: string;
  federationType?: 'static' | 'dynamic';
  routing?: boolean;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  e2eProjectName?: string;
  prefix?: string;
}
