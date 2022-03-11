import componentStoryGenerator from '../component-story/component-story';
import componentCypressSpecGenerator from '../component-cypress-spec/component-cypress-spec';
import { getComponentName } from '../../utils/ast-utils';
import * as ts from 'typescript';
import {
  convertNxGenerator,
  getProjects,
  joinPathFragments,
  logger,
  ProjectType,
  Tree,
  visitNotIgnoredFiles,
} from '@nrwl/devkit';
import { join } from 'path';

export interface StorybookStoriesSchema {
  project: string;
  generateCypressSpecs: boolean;
  js?: boolean;
  cypressProject?: string;
  rootPath?: string;
}

export function projectRootPath(
  tree: Tree,
  sourceRoot: string,
  projectType: ProjectType
): string {
  let projectDir = '';
  if (projectType === 'application') {
    // apps/test-app/src/app
    projectDir = 'app';
  } else if (projectType == 'library') {
    // libs/test-lib/src/lib
    projectDir = 'lib';
  }

  return joinPathFragments(sourceRoot, projectDir);
}

function containsComponentDeclaration(
  tree: Tree,
  componentPath: string
): boolean {
  const contents = tree.read(componentPath, 'utf-8');
  if (contents === null) {
    throw new Error(`Failed to read ${componentPath}`);
  }

  const sourceFile = ts.createSourceFile(
    componentPath,
    contents,
    ts.ScriptTarget.Latest,
    true
  );

  return !!getComponentName(sourceFile);
}

export async function createAllStories(
  tree: Tree,
  projectName: string,
  generateCypressSpecs: boolean,
  js: boolean,
  cypressProject?: string,
  rootPath?: string
) {
  const projects = getProjects(tree);
  const project = projects.get(projectName);

  const { sourceRoot, projectType } = project;
  const projectPath =
    rootPath ?? projectRootPath(tree, sourceRoot, projectType);

  let componentPaths: string[] = [];
  visitNotIgnoredFiles(tree, projectPath, (path) => {
    if (
      (path.endsWith('.tsx') && !path.endsWith('.spec.tsx')) ||
      (path.endsWith('.js') && !path.endsWith('.spec.js')) ||
      (path.endsWith('.jsx') && !path.endsWith('.spec.jsx'))
    ) {
      const ext = path.slice(path.lastIndexOf('.'));
      const storyPath = `${path.split(ext)[0]}.stories${ext}`;
      // only add component if a stories file doesnt already exist
      if (!tree.exists(storyPath)) {
        componentPaths.push(path);
      }
    }
  });

  const e2eProjectName = cypressProject || `${projectName}-e2e`;
  const e2eProject = projects.get(e2eProjectName);

  if (generateCypressSpecs && !e2eProject) {
    logger.info(
      `There was no e2e project "${e2eProjectName}" found, so cypress specs will not be generated. Pass "--cypressProject" to specify a different e2e project name`
    );
  }

  await Promise.all(
    componentPaths.map(async (componentPath) => {
      const relativeCmpDir = componentPath.replace(join(sourceRoot, '/'), '');

      if (!containsComponentDeclaration(tree, componentPath)) {
        return;
      }

      await componentStoryGenerator(tree, {
        componentPath: relativeCmpDir,
        project: projectName,
      });

      if (generateCypressSpecs && e2eProject) {
        await componentCypressSpecGenerator(tree, {
          project: projectName,
          componentPath: relativeCmpDir,
          js,
          cypressProject,
        });
      }
    })
  );
}

export async function storiesGenerator(
  host: Tree,
  schema: StorybookStoriesSchema
) {
  await createAllStories(
    host,
    schema.project,
    schema.generateCypressSpecs,
    schema.js,
    schema.cypressProject,
    schema.rootPath
  );
}

export default storiesGenerator;
export const storiesSchematic = convertNxGenerator(storiesGenerator);
