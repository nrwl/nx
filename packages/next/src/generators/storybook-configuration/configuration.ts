import {
  GeneratorCallback,
  joinPathFragments,
  logger,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { storybookConfigurationGenerator as reactStorybookConfigurationGenerator } from '@nrwl/react';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { StorybookConfigureSchema } from './schema';

export async function storybookConfigurationGenerator(
  host: Tree,
  options: StorybookConfigureSchema
) {
  const tasks: GeneratorCallback[] = [];
  const project = readProjectConfiguration(host, options.name);

  const storybookTask = await reactStorybookConfigurationGenerator(host, {
    ...options,
    rootPath: project.sourceRoot,
  });
  tasks.push(storybookTask);

  if (options.generateStories) {
    // check for _app.stories, and _document.stories - and delete them,
    // as those stories aren't useful
    [
      `${project.root}/pages/_app.stories.tsx`,
      `${project.root}/pages/_app.stories.jsx`,
      `${project.root}/pages/_document.stories.jsx`,
      `${project.root}/pages/_document.stories.jsx`,
    ]
      .filter((path) => host.exists(path))
      .forEach((path) => {
        host.delete(path);
      });
  }

  updateStoriesPaths(host, project);
  configureBabel(host, project, options.name);

  return runTasksInSerial(...tasks);
}

function updateStoriesPaths(host: Tree, project: ProjectConfiguration) {
  const mainJsPath = `${project.root}/.storybook/main.js`;
  const mainJsContent = host.read(mainJsPath, 'utf-8');

  let newContent = mainJsContent;
  if (project.projectType === 'application') {
    newContent = replaceAll(newContent, '../src/app/**/*', '../**/*');
  } else if (project.projectType === 'library') {
    newContent = replaceAll(newContent, '../src/lib/**/*', '../**/*');
  }

  host.write(mainJsPath, newContent);
}

function configureBabel(
  host: Tree,
  project: ProjectConfiguration,
  projectName: string
) {
  const babelRcPath = joinPathFragments(project.sourceRoot, '.babelrc');

  if (!host.exists(babelRcPath)) {
    logger.warn(
      `Using storybook with SWC is not supported yet - enabling babel for project "${projectName}"`
    );

    host.write(babelRcPath, JSON.stringify({ presets: ['@nrwl/next/babel'] }));
  }
}

function replaceAll(
  target: string,
  toReplace: string,
  toReplaceWith: string
): string {
  let temp = target;
  while (temp.includes(toReplace)) {
    temp = temp.replace(toReplace, toReplaceWith);
  }
  return temp;
}
