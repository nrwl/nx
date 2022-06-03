import {
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { cypressComponentConfigurationGenerator as _reactCompTestConfig } from '@nrwl/react';
import { CypressComponentConfigurationSchema } from '@nrwl/react/src/generators/cypress-component-configuration/schema';

export async function cypressComponentConfigurationGenerator(
  tree: Tree,
  options: CypressComponentConfigurationSchema
) {
  const projectConfig = readProjectConfiguration(tree, options.project);
  const installTask = await _reactCompTestConfig(tree, options);

  // TODO(caleb): how to serve next js libs? requires a next.config.js?
  const ignore = tree.read('.gitignore', 'utf-8');

  if (!ignore.includes('.next')) {
    tree.write('.gitignore', `${ignore}\n.next`);
  }

  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files'),
    projectConfig.root,
    {}
  );
  return () => {
    installTask();
  };
}

export default cypressComponentConfigurationGenerator;
