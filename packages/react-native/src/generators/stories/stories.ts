import {
  convertNxGenerator,
  ensurePackage,
  formatFiles,
  getProjects,
  Tree,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { join } from 'path';
import componentStoryGenerator from '../component-story/component-story';
import { StorybookStoriesSchema } from './schema';
import {
  containsComponentDeclaration,
  projectRootPath,
} from '@nx/react/src/generators/stories/stories';
import minimatch = require('minimatch');
import { nxVersion } from '../../utils/versions';

export async function createAllStories(
  tree: Tree,
  projectName: string,
  ignorePaths?: string[]
) {
  ensurePackage('@nx/storybook', nxVersion);
  const { isTheFileAStory } = await import('@nx/storybook/src/utils/utilities');

  const projects = getProjects(tree);
  const projectConfiguration = projects.get(projectName);

  const { sourceRoot } = projectConfiguration;
  const projectPath = await projectRootPath(tree, projectConfiguration);

  let componentPaths: string[] = [];
  visitNotIgnoredFiles(tree, projectPath, (path) => {
    if (ignorePaths?.some((pattern) => minimatch(path, pattern))) return;

    if (
      (path.endsWith('.tsx') && !path.endsWith('.spec.tsx')) ||
      (path.endsWith('.js') && !path.endsWith('.spec.js')) ||
      (path.endsWith('.jsx') && !path.endsWith('.spec.jsx'))
    ) {
      // Check if file is NOT a story (either ts/tsx or js/jsx)
      if (!isTheFileAStory(tree, path)) {
        // Since the file is not a story
        // Let's see if the .stories.* file exists
        const ext = path.slice(path.lastIndexOf('.'));
        const storyPath = `${path.split(ext)[0]}.stories${ext}`;

        if (!tree.exists(storyPath)) {
          componentPaths.push(path);
        }
      }
    }
  });

  await Promise.all(
    componentPaths.map(async (componentPath) => {
      const relativeCmpDir = componentPath.replace(join(sourceRoot, '/'), '');

      if (!containsComponentDeclaration(tree, componentPath)) {
        return;
      }

      await componentStoryGenerator(tree, {
        componentPath: relativeCmpDir,
        project: projectName,
        skipFormat: true,
      });
    })
  );
}

export async function storiesGenerator(
  host: Tree,
  schema: StorybookStoriesSchema
) {
  await createAllStories(host, schema.project, schema.ignorePaths);

  if (!schema.skipFormat) {
    await formatFiles(host);
  }
}

export default storiesGenerator;
export const storiesSchematic = convertNxGenerator(storiesGenerator);
