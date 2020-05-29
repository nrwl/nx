import {
  chain,
  Rule,
  schematic,
  SchematicContext,
  Tree,
  SchematicsException,
  noop,
} from '@angular-devkit/schematics';
import { join, Path } from '@angular-devkit/core';
import { getProjectConfig } from '@nrwl/workspace';
import { CreateComponentStoriesFileSchema } from '../component-story/component-story';
import { CreateComponentSpecFileSchema } from '../component-cypress-spec/component-cypress-spec';
import { getComponentName } from '../../utils/ast-utils';
import * as ts from 'typescript';

export interface StorybookStoriesSchema {
  project: string;
  generateCypressSpecs: boolean;
  js?: boolean;
}

function containsComponentDeclaration(
  tree: Tree,
  componentPath: string
): boolean {
  const contents = tree.read(componentPath);
  if (!contents) {
    throw new SchematicsException(`Failed to read ${componentPath}`);
  }

  const sourceFile = ts.createSourceFile(
    componentPath,
    contents.toString(),
    ts.ScriptTarget.Latest,
    true
  );

  return !!getComponentName(sourceFile);
}

export function createAllStories(
  projectName: string,
  generateCypressSpecs: boolean,
  js
): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const projectSrcRoot = getProjectConfig(tree, projectName).sourceRoot;
    const libPath = join(projectSrcRoot, '/lib');

    let componentPaths: string[] = [];
    tree.getDir(libPath).visit((filePath) => {
      if (
        (filePath.endsWith('.tsx') && !filePath.endsWith('.spec.tsx')) ||
        (filePath.endsWith('.js') && !filePath.endsWith('.spec.js')) ||
        (filePath.endsWith('.jsx') && !filePath.endsWith('.spec.jsx'))
      ) {
        componentPaths.push(filePath);
      }
    });

    return chain(
      componentPaths.map((componentPath) => {
        const relativeCmpDir = componentPath.replace(
          join('/' as Path, projectSrcRoot, '/'),
          ''
        );

        if (!containsComponentDeclaration(tree, componentPath)) {
          return chain([noop()]);
        }

        return chain([
          schematic<CreateComponentStoriesFileSchema>('component-story', {
            componentPath: relativeCmpDir,
            project: projectName,
          }),
          generateCypressSpecs
            ? schematic<CreateComponentSpecFileSchema>(
                'component-cypress-spec',
                {
                  project: projectName,
                  componentPath: relativeCmpDir,
                  js,
                }
              )
            : () => {},
        ]);
      })
    );
  };
}

export default function (schema: StorybookStoriesSchema): Rule {
  return chain([
    createAllStories(schema.project, schema.generateCypressSpecs, schema.js),
  ]);
}
