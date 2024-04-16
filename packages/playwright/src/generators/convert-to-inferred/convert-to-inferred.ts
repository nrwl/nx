import {
  formatFiles,
  type ProjectConfiguration,
  readProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { migrateExecutorToPlugin } from './lib/migrate-executor-to-plugin';

interface Schema {
  project?: string;
  all?: boolean;
  skipFormat?: boolean;
}

export async function convertToInferred(tree: Tree, options: Schema) {
  if (!options.project && !options.all) {
    options.all = true;
  }

  if (options.project && options.all) {
    throw new Error(
      `Both "--project" and "--all" options were passed. Please select one.`
    );
  }

  let project: ProjectConfiguration;
  if (options.project) {
    project = readProjectConfiguration(tree, options.project);
  }

  await migrateExecutorToPlugin(tree, project?.name, project?.root);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default convertToInferred;
