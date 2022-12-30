import {
  formatFiles,
  getProjects,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { join } from 'path';

/**
 * This function udpate the entry file option under bundle target for react native apps
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  const updateTargetEntryFile = (target: string, config) => {
    if (!config.targets?.[target]?.options?.entryFile) {
      return;
    }
    if (tree.exists(join(config.root, 'src/main.tsx'))) {
      config.targets[target].options.entryFile = `src/main.tsx`;
    }
    if (tree.exists(join(config.root, 'src/main.js'))) {
      config.targets[target].options.entryFile = `src/main.js`;
    }
  };

  for (const [name, config] of projects.entries()) {
    if (
      config.targets?.['bundle-ios']?.executor === '@nrwl/react-native:bundle'
    ) {
      updateTargetEntryFile('bundle-ios', config);
    }

    if (
      config.targets?.['bundle-android']?.executor ===
      '@nrwl/react-native:bundle'
    ) {
      updateTargetEntryFile('bundle-android', config);
    }

    updateProjectConfiguration(tree, name, config);
  }

  await formatFiles(tree);
}
