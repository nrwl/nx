import {
  addDependenciesToPackageJson,
  ensurePackage,
  formatFiles,
  GeneratorCallback,
  getProjects,
  joinPathFragments,
  ProjectConfiguration,
  runTasksInSerial,
  Tree,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { basename, join } from 'path';
import { nxVersion } from '../../utils/versions';
import { createComponentStories } from './lib/component-story';
import { minimatch } from 'minimatch';

export interface StorybookStoriesSchema {
  project: string;
  interactionTests?: boolean;
  js?: boolean;
  ignorePaths?: string[];
  skipFormat?: boolean;
}

export async function createAllStories(
  tree: Tree,
  projectName: string,
  interactionTests: boolean,
  js: boolean,
  projectConfiguration: ProjectConfiguration,
  ignorePaths?: string[]
) {
  const { sourceRoot } = projectConfiguration;
  let componentPaths: string[] = [];
  const pathsToCheck = [
    joinPathFragments(sourceRoot, 'app'), // Default component folder for apps
    joinPathFragments(sourceRoot, 'lib'), // Default component folder for libs
    joinPathFragments(sourceRoot, 'components'), // Additional component folder used by Nuxt
  ];

  for (const p of pathsToCheck) {
    visitNotIgnoredFiles(tree, p, (path) => {
      // Ignore private files starting with "_".
      if (basename(path).startsWith('_')) return;
      if (ignorePaths?.some((pattern) => minimatch(path, pattern))) return;
      if (path.endsWith('.vue')) {
        // Let's see if the .stories.* file exists
        const ext = path.slice(path.lastIndexOf('.'));
        const storyPathJs = `${path.split(ext)[0]}.stories.js`;
        const storyPathTs = `${path.split(ext)[0]}.stories.ts`;

        if (!tree.exists(storyPathJs) && !tree.exists(storyPathTs)) {
          componentPaths.push(path);
        }
      }
    });
  }

  await Promise.all(
    componentPaths.map(async (componentPath) => {
      const relativeCmpDir = componentPath.replace(join(sourceRoot, '/'), '');
      createComponentStories(
        tree,
        {
          project: projectName,
          interactionTests,
          js,
        },
        relativeCmpDir
      );
    })
  );
}

export async function storiesGenerator(
  host: Tree,
  schema: StorybookStoriesSchema
) {
  const projects = getProjects(host);
  const projectConfiguration = projects.get(schema.project);
  schema.interactionTests = schema.interactionTests ?? true;
  await createAllStories(
    host,
    schema.project,
    schema.interactionTests,
    schema.js,
    projectConfiguration,
    schema.ignorePaths
  );

  const tasks: GeneratorCallback[] = [];

  if (schema.interactionTests) {
    const { interactionTestsDependencies, addInteractionsInAddons } =
      ensurePackage<typeof import('@nx/storybook')>('@nx/storybook', nxVersion);
    tasks.push(
      addDependenciesToPackageJson(host, {}, interactionTestsDependencies())
    );
    addInteractionsInAddons(host, projectConfiguration);
  }

  if (!schema.skipFormat) {
    await formatFiles(host);
  }
  return runTasksInSerial(...tasks);
}

export default storiesGenerator;
