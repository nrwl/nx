export * from './src/create-workspace';
export type { CreateWorkspaceOptions } from './src/create-workspace-options';

// Internal utilities exported for create-nx-plugin
export {
  determineDefaultBase,
  determineNxCloud,
  determinePackageManager,
} from './src/internal-utils/prompts';
export {
  withAllPrompts,
  withGitOptions,
  withNxCloud,
  withOptions,
  withPackageManager,
} from './src/internal-utils/yargs-options';
export { output } from './src/utils/output';
export { NxCloud } from './src/utils/nx/nx-cloud';
export type { PackageManager } from './src/utils/package-manager';
export { messages, recordStat } from './src/utils/nx/ab-testing';
