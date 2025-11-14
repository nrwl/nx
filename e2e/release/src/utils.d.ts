export declare function setupWorkspaces(
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun',
  ...packages: string[]
): void;
export declare function prepareAndInstallDependencies(
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun',
  installCommand: string
): Promise<void>;
//# sourceMappingURL=utils.d.ts.map
