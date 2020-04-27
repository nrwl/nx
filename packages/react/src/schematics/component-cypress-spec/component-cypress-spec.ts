import { normalize, schema } from '@angular-devkit/core';
import {
  chain,
  move,
  Rule,
  SchematicContext,
  SchematicsException,
  applyTemplates,
  Tree,
  url
} from '@angular-devkit/schematics';
import { findNodes, getProjectConfig } from '@nrwl/workspace';
import { applyWithSkipExisting } from '@nrwl/workspace/src/utils/ast-utils';
import { join } from 'path';
import ts = require('typescript');
import {
  getComponentName,
  getComponentPropsInterface
} from '../../utils/ast-utils';

export interface CreateComponentSpecFileSchema {
  project: string;
  componentPath: string;
  js?: boolean;
}

export default function(schema: CreateComponentSpecFileSchema): Rule {
  return chain([createComponentSpecFile(schema)]);
}

// TODO: candidate to refactor with the angular component story
export function getKnobDefaultValue(property: ts.SyntaxKind): string {
  const typeNameToDefault: Record<number, any> = {
    [ts.SyntaxKind.StringKeyword]: '',
    [ts.SyntaxKind.NumberKeyword]: 0,
    [ts.SyntaxKind.BooleanKeyword]: false
  };

  const resolvedValue = typeNameToDefault[property];
  if (typeof resolvedValue === undefined) {
    return '';
  } else {
    return resolvedValue;
  }
}

export function createComponentSpecFile({
  project,
  componentPath,
  js
}: CreateComponentSpecFileSchema): Rule {
  return (tree: Tree, context: SchematicContext): Rule => {
    const e2eLibIntegrationFolderPath =
      getProjectConfig(tree, project + '-e2e').sourceRoot + '/integration';

    const proj = getProjectConfig(tree, project);
    const componentFilePath = normalize(join(proj.sourceRoot, componentPath));
    const componentName = componentFilePath
      .slice(componentFilePath.lastIndexOf('/') + 1)
      .replace('.tsx', '')
      .replace('.jsx', '')
      .replace('.js', '');

    const contents = tree.read(componentFilePath);
    if (!contents) {
      throw new SchematicsException(`Failed to read ${componentFilePath}`);
    }

    const sourceFile = ts.createSourceFile(
      componentFilePath,
      contents.toString(),
      ts.ScriptTarget.Latest,
      true
    );

    const cmpDeclaration = getComponentName(sourceFile);
    if (!cmpDeclaration) {
      throw new SchematicsException(
        `Could not find any React component in file ${componentFilePath}`
      );
    }

    const propsInterface = getComponentPropsInterface(sourceFile);

    let props: {
      name: string;
      defaultValue: any;
    }[] = [];

    if (propsInterface) {
      props = propsInterface.members.map((member: ts.PropertySignature) => {
        return {
          name: (member.name as ts.Identifier).text,
          defaultValue: getKnobDefaultValue(member.type.kind)
        };
      });
    }

    return applyWithSkipExisting(url('./files'), [
      applyTemplates({
        projectName: project,
        componentName,
        componentSelector: (cmpDeclaration as any).name.text,
        props,
        fileExt: js ? 'js' : 'ts'
      }),
      move(e2eLibIntegrationFolderPath + '/' + componentName)
    ]);
  };
}
