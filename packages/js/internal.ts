// Semi-private surface for first-party Nx packages.
//
// External plugins should NOT import from here — this entry is curated for
// internal consumers and may change without semver protection. Consider it
// the @nx/js equivalent of `@nx/devkit/internal`.

// Re-exports of nx-source internals (need `no-restricted-imports` overrides).
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
export {
  registerTsProject,
  registerTsConfigPaths,
} from 'nx/src/plugins/js/utils/register';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
export {
  TargetProjectLocator,
  isBuiltinModuleImport,
} from 'nx/src/plugins/js/project-graph/build-dependencies/target-project-locator';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
export { findProjectsNpmDependencies } from 'nx/src/plugins/js/package-json/create-package-json';

// Raw tsconfig walkers (the other AST utils ship via the public @nx/js entry)
export {
  walkTsconfigExtendsChain,
  type RawTsconfigJsonCache,
} from './src/utils/typescript/raw-tsconfig';

// TS solution setup detection
export {
  TS_SOLUTION_SETUP_TSCONFIG_INPUT,
  addProjectToTsSolutionWorkspace,
  assertNotUsingTsSolutionSetup,
  findRuntimeTsConfigName,
  getDefinedCustomConditionName,
  getProjectSourceRoot,
  getProjectType,
  isUsingTsSolutionSetup,
  shouldConfigureTsSolutionSetup,
  updateTsconfigFiles,
} from './src/utils/typescript/ts-solution-setup';

// TypeScript helpers (resolvePathsBaseUrl, extractTsConfigBase,
// tsConfigBaseOptions, addTsLibDependencies, resolveModuleByImport — all ship
// via the public @nx/js entry)
export { ensureTypescript } from './src/utils/typescript/ensure-typescript';
export { getNeededCompilerOptionOverrides } from './src/utils/typescript/configuration';
export {
  compileTypeScript,
  type TypeScriptCompilationOptions,
} from './src/utils/typescript/compilation';

// Build orchestration
export {
  calculateProjectBuildableDependencies,
  calculateProjectDependencies,
  computeCompilerOptionsPaths,
  createTmpTsConfig,
  type DependentBuildableProjectNode,
} from './src/utils/buildable-libs-utils';

// SWC helpers
export { addSwcConfig, addSwcTestConfig } from './src/utils/swc/add-swc-config';
export {
  addSwcDependencies,
  addSwcRegisterDependencies,
} from './src/utils/swc/add-swc-dependencies';

// Asset helpers
export { type AssetGlob } from './src/utils/assets/assets';
export { CopyAssetsHandler } from './src/utils/assets/copy-assets-handler';

// Package-manager / package.json helpers
export { sortPackageJsonFields } from './src/utils/package-json/sort-fields';
export { getNpmScope } from './src/utils/package-json/get-npm-scope';
export {
  getProjectPackageManagerWorkspaceState,
  getProjectPackageManagerWorkspaceStateWarningTask,
} from './src/utils/package-manager-workspaces';
export { findNpmDependencies } from './src/utils/find-npm-dependencies';

// Plugin helpers
export {
  addBuildAndWatchDepsTargets,
  isValidPackageJsonBuildConfig,
} from './src/plugins/typescript/util';

// Generator helpers
export {
  normalizeLinterOption,
  normalizeUnitTestRunnerOption,
} from './src/utils/generator-prompts';
export { createGlobPatternsForDependencies } from './src/utils/generate-globs';
export { getImportPath } from './src/utils/get-import-path';
export { stripGlobToBaseDir } from './src/utils/strip-glob-to-base-dir';
export { addLocalRegistryScripts } from './src/utils/add-local-registry-scripts';

// Library generator schema type (the generator itself + setupVerdaccio ship
// via the public @nx/js entry)
export type { LibraryGeneratorSchema } from './src/generators/library/schema';
export {
  addReleaseConfigForNonTsSolution,
  addReleaseConfigForTsSolution,
  releaseTasks,
} from './src/generators/library/utils/add-release-config';

// Version constants
export {
  nxVersion,
  esbuildVersion,
  prettierVersion,
  swcCliVersion,
  swcCoreVersion,
  swcHelpersVersion,
  swcNodeVersion,
  tsLibVersion,
  typesNodeVersion,
} from './src/utils/versions';
