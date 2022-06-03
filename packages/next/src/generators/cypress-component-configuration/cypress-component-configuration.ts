import {
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { cypressComponentConfigGenerator as _reactCompTestConfig } from '@nrwl/react';
import type { CypressComponentConfigurationSchema } from '@nrwl/react/src/generators/cypress-component-configuration/schema';

export async function cypressComponentConfigGenerator(
  tree: Tree,
  options: CypressComponentConfigurationSchema
) {
  const projectConfig = readProjectConfiguration(tree, options.project);
  const installTask = await _reactCompTestConfig(tree, options);

  if (tree.exists('.gitignore')) {
    const ignore = tree.read('.gitignore', 'utf-8');
    if (!ignore.includes('.next')) {
      tree.write('.gitignore', `${ignore}\n.next`);
    }
  }

  tree.delete(joinPathFragments(projectConfig.root, 'cypress.config.ts'));
  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files'),
    projectConfig.root,
    {
      tmpl: '',
    }
  );
  return () => {
    installTask();
  };
}

export default cypressComponentConfigGenerator;
