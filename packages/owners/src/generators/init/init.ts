import {
  addDependenciesToPackageJson,
  formatFiles,
  type GeneratorCallback,
  logger,
  runTasksInSerial,
  type Tree,
  updateJson,
} from '@nx/devkit';
import { getVcsRemoteInfo } from '@nx/devkit/internal';
import { nxVersion } from '../../utils/versions';
import type { InitGeneratorSchema } from './schema';

const pluginName = '@nx/owners';
const syncGeneratorName = '@nx/owners:sync-codeowners-file';

export async function initGenerator(
  tree: Tree,
  options: InitGeneratorSchema = {}
): Promise<GeneratorCallback> {
  updateJson(tree, 'nx.json', (json) => {
    json.plugins ??= [];
    if (
      !json.plugins.some((p) =>
        typeof p === 'string' ? p === pluginName : p.plugin === pluginName
      )
    ) {
      json.plugins.push(pluginName);
    }

    // The plugin cannot register its sync generator itself
    json.sync ??= {};
    json.sync.globalGenerators ??= [];
    if (!json.sync.globalGenerators.includes(syncGeneratorName)) {
      json.sync.globalGenerators.push(syncGeneratorName);
    }

    if (typeof json.owners !== 'object') {
      json.owners = {};
    }
    json.owners.format ??= inferFormat(tree);
    if (json.owners.format === 'gitlab') {
      json.owners.sections ??= [];
    }
    json.owners.patterns ??= [];
    if (tree.exists('CODEOWNERS')) {
      json.owners.outputPath ??= 'CODEOWNERS';
    }

    return json;
  });

  const tasks: GeneratorCallback[] = [];
  if (!options.skipPackageJson) {
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        { [pluginName]: nxVersion },
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

export default initGenerator;

function inferFormat(
  tree: Tree
): 'github' | 'gitlab' | 'bitbucket' | undefined {
  if (tree.exists('.github')) {
    return 'github';
  }
  if (tree.exists('.bitbucket')) {
    return 'bitbucket';
  }
  if (tree.exists('.gitlab')) {
    return 'gitlab';
  }

  const domain = getVcsRemoteInfo(tree.root)?.domain;
  for (const format of ['github', 'gitlab', 'bitbucket'] as const) {
    if (domain?.includes(format)) {
      return format;
    }
  }

  logger.warn(
    'Could not infer the VCS provider for this workspace. Set owners.format in nx.json to "github", "gitlab", or "bitbucket".'
  );
  return undefined;
}
