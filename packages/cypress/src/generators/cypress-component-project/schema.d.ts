export interface CypressComponentProjectSchema {
  project: string;
  skipFormat: boolean;
  bundler?: 'webpack' | 'vite';
}
