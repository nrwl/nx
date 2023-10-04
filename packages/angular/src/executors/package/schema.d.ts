export interface BuildAngularLibraryExecutorOptions {
  project: string;
  /**
   * @deprecated Configure the project to use the `@nx/dependency-checks` ESLint
   * rule instead (https://nx.dev/packages/eslint-plugin/documents/dependency-checks).
   * It will be removed in v17.
   */
  buildableProjectDepsInPackageJsonType?: 'dependencies' | 'peerDependencies';
  tailwindConfig?: string;
  tsConfig?: string;
  /**
   * @deprecated Configure the project to use the `@nx/dependency-checks` ESLint
   * rule instead (https://nx.dev/packages/eslint-plugin/documents/dependency-checks).
   * It will be removed in v17.
   */
  updateBuildableProjectDepsInPackageJson?: boolean;
  watch?: boolean;
}
