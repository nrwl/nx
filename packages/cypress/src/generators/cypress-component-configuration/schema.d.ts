export interface CypressComponentConfigurationSchema {
  project: string;
  skipFormat: boolean;
  bundler?: 'webpack' | 'vite';
}
