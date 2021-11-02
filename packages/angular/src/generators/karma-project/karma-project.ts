import type { Tree } from '@nrwl/devkit';
import { formatFiles } from '@nrwl/devkit';
import { checkProjectTestTarget } from './lib/check-test-target';
import { generateKarmaProjectFiles } from './lib/generate-karma-project-files';
import { updateTsConfigs } from './lib/update-tsconfig';
import { updateWorkspaceConfig } from './lib/update-workspace-config';
import type { KarmaProjectOptions } from './schema';

export async function karmaProjectGenerator(
  tree: Tree,
  options: KarmaProjectOptions
) {
  checkProjectTestTarget(tree, options.project);
  generateKarmaProjectFiles(tree, options.project);
  updateTsConfigs(tree, options.project);
  updateWorkspaceConfig(tree, options.project);
  await formatFiles(tree);
}

export default karmaProjectGenerator;
