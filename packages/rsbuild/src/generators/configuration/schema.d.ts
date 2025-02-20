export interface Schema {
  project: string;
  entry?: string;
  tsConfig?: string;
  devServerPort?: number;
  target?: 'node' | 'web' | 'web-worker';
  skipValidation?: boolean;
  skipFormat?: boolean;
}
