export interface CypressComponentConfigurationSchema {
  project: string;
  skipFormat: boolean;
  directory?: string;
  bundler?: 'webpack' | 'vite';
}
