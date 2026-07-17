import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  ensurePackage,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  offsetFromRoot,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  type TargetConfiguration,
  type TargetDefaults,
  Tree,
  updateJson,
  updateNxJson,
} from '@nx/devkit';
import { getRelativePathToRootTsConfig } from '@nx/js';
import {
  addSwcRegisterDependencies,
  isUsingTsSolutionSetup,
} from '@nx/js/internal';
import { join } from 'path';
import { assertSupportedEslintVersion } from '../../utils/assert-supported-eslint-version';
import { nxVersion, versions } from '../../utils/versions';
import { workspaceLintPluginDir } from '../../utils/workspace-lint-rules';

export const WORKSPACE_RULES_PROJECT_NAME = 'eslint-rules';

export const WORKSPACE_PLUGIN_DIR = 'tools/eslint-rules';

export interface LintWorkspaceRulesProjectGeneratorOptions {
  skipFormat?: boolean;
  addPlugin?: boolean;
}

export async function lintWorkspaceRulesProjectGenerator(
  tree: Tree,
  options: LintWorkspaceRulesProjectGeneratorOptions = {}
) {
  assertSupportedEslintVersion(tree);

  const { configurationGenerator } = ensurePackage<typeof import('@nx/jest')>(
    '@nx/jest',
    nxVersion
  );
  const tasks: GeneratorCallback[] = [];

  // Noop if the workspace rules project already exists
  try {
    readProjectConfiguration(tree, WORKSPACE_RULES_PROJECT_NAME);
    return;
  } catch {}

  // Create the project, the test target is added below by the jest generator
  addProjectConfiguration(tree, WORKSPACE_RULES_PROJECT_NAME, {
    root: WORKSPACE_PLUGIN_DIR,
    sourceRoot: WORKSPACE_PLUGIN_DIR,
    targets: {},
  });

  // Generate the required files
  generateFiles(tree, join(__dirname, 'files'), workspaceLintPluginDir, {
    tmpl: '',
    offsetFromRoot: offsetFromRoot(WORKSPACE_PLUGIN_DIR),
    rootTsConfigPath: getRelativePathToRootTsConfig(tree, WORKSPACE_PLUGIN_DIR),
  });

  /**
   * Ensure that when workspace rules are updated they cause all projects to be affected for now.
   * TODO: Explore writing a ProjectGraph plugin to make this more surgical.
   */
  const nxJson = readNxJson(tree);

  const lintEntry = findLintTargetDefault(nxJson.targetDefaults);
  if (lintEntry?.inputs) {
    lintEntry.inputs.push(`{workspaceRoot}/${WORKSPACE_PLUGIN_DIR}/**/*`);

    updateNxJson(tree, nxJson);
  }

  // Add jest to the project and return installation task
  tasks.push(
    await configurationGenerator(tree, {
      ...options,
      project: WORKSPACE_RULES_PROJECT_NAME,
      supportTsx: false,
      skipSerializers: true,
      setupFile: 'none',
      compiler: isUsingTsSolutionSetup(tree) ? 'swc' : 'tsc',
      skipFormat: true,
      testEnvironment: 'node',
    })
  );

  updateJson(
    tree,
    join(workspaceLintPluginDir, 'tsconfig.spec.json'),
    (json) => {
      delete json.compilerOptions?.module;
      delete json.compilerOptions?.moduleResolution;
      // Inherits `module: node16` from the project's base `tsconfig.json`,
      // which requires `isolatedModules: true` to reliably honor packages'
      // `exports` maps (e.g. `@typescript-eslint/rule-tester`).
      json.compilerOptions = {
        ...json.compilerOptions,
        isolatedModules: true,
      };

      if (json.include) {
        json.include = json.include.map((v) => {
          if (v.startsWith('src/**')) {
            return v.replace('src/', '');
          }
          return v;
        });
      }
      if (json.exclude) {
        json.exclude = json.exclude.map((v) => {
          if (v.startsWith('src/**')) {
            return v.replace('src/', '');
          }
          return v;
        });
      }
      return json;
    }
  );

  // Add swc dependencies
  tasks.push(addSwcRegisterDependencies(tree));

  const { typescriptESLintVersion } = versions(tree);
  tasks.push(
    addDependenciesToPackageJson(
      tree,
      {},
      {
        '@typescript-eslint/utils': typescriptESLintVersion,
      },
      undefined,
      true
    )
  );

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

function findLintTargetDefault(
  td: TargetDefaults | undefined
): Partial<TargetConfiguration> | undefined {
  const value = td?.['lint'];
  if (value === undefined) return undefined;
  // A target default value can be a plain config object or an array of
  // filtered entries; use the filter-less (catch-all) entry.
  if (Array.isArray(value)) {
    const found = value.find((e) => e.filter === undefined);
    if (!found) return undefined;
    const { filter: _filter, ...rest } = found;
    return rest;
  }
  return value;
}
