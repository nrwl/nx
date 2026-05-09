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
import { addSwcRegisterDependencies } from '@nx/js/src/utils/swc/add-swc-dependencies';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { join } from 'path';
import { nxVersion } from '../../utils/versions';
import { getTypeScriptEslintVersionToInstall } from '../../utils/version-utils';
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

  const typescriptEslintVersion = getTypeScriptEslintVersionToInstall(tree);
  tasks.push(
    addDependenciesToPackageJson(
      tree,
      {},
      {
        '@typescript-eslint/utils': typescriptEslintVersion,
      }
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
  if (!td) return undefined;
  if (Array.isArray(td)) {
    return td.find(
      (e) =>
        e.target === 'lint' &&
        e.projects === undefined &&
        e.plugin === undefined
    );
  }
  return td['lint'];
}
