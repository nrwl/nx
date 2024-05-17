import {
  TargetConfiguration,
  Tree,
  addProjectConfiguration,
  joinPathFragments,
} from '@nx/devkit';
import { NormalizedSchema } from '../schema';

export async function addProject(tree: Tree, options: NormalizedSchema) {
  const targets: Record<string, TargetConfiguration> = {};

  addProjectConfiguration(
    tree,
    options.projectName,
    {
      projectType: 'application',
      root: options.appProjectRoot,
      sourceRoot: joinPathFragments(options.appProjectRoot, 'src'),
      tags: options.parsedTags,
      targets,
    },
    options.standaloneConfig
  );
}
