export interface CypressComponentConfigurationSchema {
  project: string;
  skipFormat: boolean;
  directory?: string;
  bundler?: 'webpack' | 'vite';
  jsx?: boolean;
  addPlugin?: boolean;

  /**
   * @internal
   */
  addExplicitTargets?: boolean;
  framework?: 'next';
}
