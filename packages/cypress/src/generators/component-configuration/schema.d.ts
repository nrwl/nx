export interface CypressComponentConfigurationSchema {
  project: string;
  skipFormat: boolean;
  directory?: string;
  bundler?: 'webpack' | 'vite';
  jsx?: boolean;
  addPlugin?: boolean;
  skipPackageJson?: boolean;

  /**
   * @internal
   */
  addExplicitTargets?: boolean;
  framework?: 'next';
}
