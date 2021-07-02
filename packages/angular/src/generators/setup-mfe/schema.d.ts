export interface Schema {
  appName: string;
  mfeType: 'shell' | 'remote';
  port?: number;
  remotes?: string[];
  skipFormat?: boolean;
}
