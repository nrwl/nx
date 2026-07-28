import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  GeneratorCallback,
  getDependencyVersionFromPackageJson,
  readNxJson,
  runTasksInSerial,
  TargetConfiguration,
  Tree,
  updateJson,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import {
  addPlugin,
  assertSupportedPackageVersion,
  findTargetDefault,
  upsertTargetDefault,
} from '@nx/devkit/internal';
import { createNodes } from '../../plugins/plugin.js';
import { OXLINT_CONFIG_FILENAMES } from '../../utils/config-file.js';
import {
  minSupportedOxlintVersion,
  nxVersion,
  oxlintVersion,
} from '../../utils/versions.js';

export interface InitGeneratorSchema {
  skipPackageJson?: boolean;
  keepExistingVersions?: boolean;
  updatePackageScripts?: boolean;
  skipFormat?: boolean;
  addPlugin?: boolean;
}

/**
 * `lint` first so greenfield workspaces get the natural name; `addPlugin`
 * falls through the rest when ESLint already owns `lint`.
 */
const OXLINT_TARGET_NAMES = ['lint', 'oxlint', 'oxlint:lint', 'oxlint-lint'];

export async function initGeneratorInternal(
  tree: Tree,
  options: InitGeneratorSchema
) {
  assertSupportedPackageVersion(tree, 'oxlint', minSupportedOxlintVersion);

  const tasks: GeneratorCallback[] = [];

  const nxJson = readNxJson(tree);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson?.useInferencePlugins !== false;

  options.addPlugin ??= addPluginDefault;

  if (options.addPlugin) {
    await addPlugin(
      tree,
      await createProjectGraphAsync(),
      '@nx/oxlint',
      createNodes,
      { targetName: OXLINT_TARGET_NAMES },
      options.updatePackageScripts
    );
  } else {
    addTargetDefaults(tree);
  }

  ensureRootConfig(tree);
  updateVsCodeRecommendedExtensions(tree);

  if (!options.skipPackageJson) {
    const devDependencies: Record<string, string> = { oxlint: oxlintVersion };
    // Only declare ourselves when absent. `addDependenciesToPackageJson`
    // compares versions and treats any non-semver range (`link:`, `file:`,
    // `workspace:`) as lower than whatever it is given, so re-declaring would
    // replace a deliberate local reference with a plain version.
    if (!getDependencyVersionFromPackageJson(tree, '@nx/oxlint')) {
      devDependencies['@nx/oxlint'] = nxVersion;
    }

    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        devDependencies,
        undefined,
        options.keepExistingVersions
      )
    );
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export function initGenerator(tree: Tree, options: InitGeneratorSchema) {
  return initGeneratorInternal(tree, { addPlugin: false, ...options });
}

function addTargetDefaults(tree: Tree) {
  const nxJson = readNxJson(tree);
  const existing = findTargetDefault(nxJson.targetDefaults, {
    executor: '@nx/oxlint:lint',
  });

  const patch: Partial<TargetConfiguration> = {};
  if (existing?.cache === undefined) {
    patch.cache = true;
  }
  if (existing?.inputs === undefined) {
    patch.inputs = [
      'default',
      '^default',
      ...OXLINT_CONFIG_FILENAMES.map((file) => `{workspaceRoot}/${file}`),
      { externalDependencies: ['oxlint'] },
    ];
  }

  if (Object.keys(patch).length > 0) {
    upsertTargetDefault(tree, nxJson, {
      executor: '@nx/oxlint:lint',
      ...patch,
    });
    updateNxJson(tree, nxJson);
  }
}

/**
 * Appends the official Oxc extension to existing VS Code recommendations.
 * Only touches the file when it is already there — setting up a linter is not
 * a reason to start dictating a workspace's editor config.
 */
function updateVsCodeRecommendedExtensions(tree: Tree) {
  if (!tree.exists('.vscode/extensions.json')) {
    return;
  }

  updateJson(tree, '.vscode/extensions.json', (json) => {
    json.recommendations ??= [];
    const extension = 'oxc.oxc-vscode';
    if (!json.recommendations.includes(extension)) {
      json.recommendations.push(extension);
    }
    return json;
  });
}

function ensureRootConfig(tree: Tree) {
  if (OXLINT_CONFIG_FILENAMES.some((file) => tree.exists(file))) {
    return;
  }

  // Mirrors what `oxlint --init` scaffolds. The schema is resolved from
  // `node_modules` rather than a URL so it matches the installed Oxlint
  // version and works offline; this is only ever written at the workspace
  // root, where `oxlint` is a direct dependency.
  writeJson(tree, '.oxlintrc.json', {
    $schema: './node_modules/oxlint/configuration_schema.json',
    plugins: ['typescript', 'unicorn', 'oxc'],
    categories: { correctness: 'error' },
    rules: {},
    env: { builtin: true },
  });
}

export default initGenerator;
