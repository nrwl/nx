export interface Schema {
  project: string;
  entry?: string;
  tsConfig?: string;
  target?: 'node' | 'web' | 'web-worker';
  skipValidation?: boolean;
  skipFormat?: boolean;
}
