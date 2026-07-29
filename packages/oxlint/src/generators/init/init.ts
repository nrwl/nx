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
  type ProjectGraph,
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
 * `lint` first so greenfield workspaces get the natural name, falling through
 * the rest when something else already owns it.
 */
const OXLINT_TARGET_NAMES = ['lint', 'oxlint', 'oxlint:lint', 'oxlint-lint'];

/**
 * The candidate target names nothing in the workspace already uses.
 *
 * `addPlugin` can resolve this itself, but it does so by running our own
 * `createNodes` against the real filesystem — where the root config does not
 * exist yet on a first install, because the `Tree` has not been flushed. Our
 * plugin returns no projects without a config, so `addPlugin` would see zero
 * conflicts and take `lint` even in a workspace where ESLint owns it. Reading
 * the existing graph answers the same question without that dependency.
 */
function resolveTargetNames(graph: ProjectGraph): string[] {
  const taken = new Set<string>();
  for (const node of Object.values(graph.nodes ?? {})) {
    for (const target of Object.keys(node.data?.targets ?? {})) {
      taken.add(target);
    }
  }

  const available = OXLINT_TARGET_NAMES.filter((name) => !taken.has(name));
  if (!available.length) {
    throw new Error(
      `Could not add the @nx/oxlint plugin: every candidate target name is already in use (${OXLINT_TARGET_NAMES.join(
        ', '
      )}). Rename one of them, or pass \`--targetName\` to choose your own.`
    );
  }

  // Hand `addPlugin` the whole remaining list rather than one name, so it keeps
  // its own fallback chain if its per-project probe disagrees with this one.
  return available;
}

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
    const graph = await createProjectGraphAsync();
    await addPlugin(
      tree,
      graph,
      '@nx/oxlint',
      createNodes,
      { targetName: resolveTargetNames(graph) },
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
