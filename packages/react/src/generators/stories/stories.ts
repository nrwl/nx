import componentStoryGenerator from '../component-story/component-story';
import componentCypressSpecGenerator from '../component-cypress-spec/component-cypress-spec';
import { getComponentName } from '../../utils/ast-utils';
import * as ts from 'typescript';
import {
  convertNxGenerator,
  getProjects,
  joinPathFragments,
  ProjectType,
  Tree,
  visitNotIgnoredFiles,
} from '@nrwl/devkit';
import { join } from 'path';

export interface StorybookStoriesSchema {
  project: string;
  generateCypressSpecs: boolean;
  js?: boolean;
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
  const contents = tree.read(componentPath);
  if (!contents) {
    throw new Error(`Failed to read ${componentPath}`);
  }

  const sourceFile = ts.createSourceFile(
    componentPath,
    contents.toString(),
    ts.ScriptTarget.Latest,
    true
  );

  return !!getComponentName(sourceFile);
}

export async function createAllStories(
  tree: Tree,
  projectName: string,
  generateCypressSpecs: boolean,
  js: boolean
) {
  const projects = getProjects(tree);
  const project = projects.get(projectName);

  const { sourceRoot, projectType } = project;
  const libPath = projectRootPath(tree, sourceRoot, projectType);

  let componentPaths: string[] = [];
  visitNotIgnoredFiles(tree, libPath, (path) => {
    if (
      (path.endsWith('.tsx') && !path.endsWith('.spec.tsx')) ||
      (path.endsWith('.js') && !path.endsWith('.spec.js')) ||
      (path.endsWith('.jsx') && !path.endsWith('.spec.jsx'))
    ) {
      componentPaths.push(path);
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
      });

      if (generateCypressSpecs) {
        await componentCypressSpecGenerator(tree, {
          project: projectName,
          componentPath: relativeCmpDir,
          js,
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
    schema.js
  );
}

export default storiesGenerator;
export const storiesSchematic = convertNxGenerator(storiesGenerator);
