import { cypressComponentProject } from '@nrwl/cypress';
import { formatFiles, readProjectConfiguration, Tree } from '@nrwl/devkit';
import { addFiles } from './lib/add-files';
import { updateProjectConfig } from './lib/update-configs';
import { CypressComponentConfigurationSchema } from './schema.d';

/**
 * This is for using cypresses own Component testing, if you want to use test
 * storybook components then use componentCypressGenerator instead.
 *
 */
export async function cypressComponentConfigGenerator(
  tree: Tree,
  options: CypressComponentConfigurationSchema
) {
  const projectConfig = readProjectConfiguration(tree, options.project);
  const installTask = await cypressComponentProject(tree, {
    project: options.project,
    skipFormat: true,
  });

  await updateProjectConfig(tree, options);
  addFiles(tree, projectConfig, options);
  if (options.skipFormat) {
    await formatFiles(tree);
  }

  return () => {
    installTask();
  };
}

export default cypressComponentConfigGenerator;
