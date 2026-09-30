// Semi-private surface for first-party Nx packages.
//
// External consumers should NOT import from here — this entry is curated for
// internal consumers and may change without semver protection. Mirrors
// `@nx/devkit/internal`.

export {
  determineDefaultBase,
  determineLinterOptions,
  determineNxCloud,
  determinePackageManager,
  LINTERS,
} from './src/internal-utils/prompts';
export type { Linter } from './src/internal-utils/prompts';
export {
  selectPrompt,
  textPrompt,
  confirmationPrompt,
} from './src/internal-utils/prompt-helpers';
export {
  withAllPrompts,
  withGitOptions,
  withNxCloud,
  withOptions,
  withPackageManager,
} from './src/internal-utils/yargs-options';
export { output } from './src/utils/output';
export type { NxCloud } from './src/utils/nx/nx-cloud';
export type { PackageManager } from './src/utils/package-manager';
export { messages, recordStat } from './src/utils/nx/ab-testing';
