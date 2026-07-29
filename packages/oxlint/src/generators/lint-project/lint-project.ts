import {
  formatFiles,
  GeneratorCallback,
  logger,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { hasOxlintPlugin } from '../../utils/plugin.js';
import { initGenerator, OXLINT_TARGET_NAMES } from '../init/init.js';
import { addPluginsToOxlintConfig } from '../../utils/oxlint-config.js';

export interface LintProjectGeneratorSchema {
  project: string;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  keepExistingVersions?: boolean;
  addPlugin?: boolean;
  addExplicitTargets?: boolean;
  /** Oxlint plugins to enable for this project, e.g. `['react', 'jsx-a11y']`. */
  plugins?: string[];
}

export function lintProjectGenerator(
  tree: Tree,
  options: LintProjectGeneratorSchema
) {
  return lintProjectGeneratorInternal(tree, { addPlugin: false, ...options });
}

export async function lintProjectGeneratorInternal(
  tree: Tree,
  options: LintProjectGeneratorSchema
) {
  const nxJson = readNxJson(tree);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson?.useInferencePlugins !== false;
  options.addPlugin ??= addPluginDefault;

  const tasks: GeneratorCallback[] = [];
  tasks.push(
    await initGenerator(tree, {
      skipFormat: true,
      skipPackageJson: options.skipPackageJson,
      keepExistingVersions: options.keepExistingVersions,
      addPlugin: options.addPlugin,
    })
  );

  const projectConfig = readProjectConfiguration(tree, options.project);

  if (options.plugins?.length) {
    addPluginsToOxlintConfig(tree, projectConfig.root, options.plugins);
  }

  const hasPlugin = hasOxlintPlugin(tree);
  if (!hasPlugin || options.addExplicitTargets) {
    projectConfig.targets ??= {};

    // Look for an Oxlint target under *any* name first. Choosing the name
    // before checking ownership would step aside from our own `lint` target
    // onto the free `oxlint`, writing a second identical target on a re-run.
    const existing = Object.entries(projectConfig.targets).find(
      ([, target]) => target.executor === '@nx/oxlint:lint'
    );

    if (existing) {
      // It may carry `typeAware`, a custom `tsconfig` or extra patterns set by
      // hand, so leave it exactly as it is.
      logger.info(
        `Project "${options.project}" already has an Oxlint target "${existing[0]}"; leaving it as is.`
      );
    } else {
      // `lint` first, the name inference prefers, then the same fallbacks the
      // plugin registration walks. Declining to add a target at all would be a
      // silent no-op on a generator the user explicitly asked for.
      const targetName = OXLINT_TARGET_NAMES.find(
        (name) => !projectConfig.targets[name]
      );

      if (!targetName) {
        logger.warn(
          `Did not add an Oxlint target to "${options.project}": every candidate name ` +
            `(${OXLINT_TARGET_NAMES.join(', ')}) is already taken. Rename one of them, ` +
            `then re-run this generator.`
        );
      } else {
        projectConfig.targets[targetName] = {
          executor: '@nx/oxlint:lint',
          options: {
            lintFilePatterns: ['{projectRoot}'],
          },
        };
        updateProjectConfiguration(tree, options.project, projectConfig);
      }
    }
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default lintProjectGenerator;
