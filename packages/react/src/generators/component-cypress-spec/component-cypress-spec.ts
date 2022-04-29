import {
  findExportDeclarationsForJsx,
  getComponentNode,
  getComponentPropsInterface,
} from '../../utils/ast-utils';

import * as ts from 'typescript';
import {
  convertNxGenerator,
  generateFiles,
  getProjects,
  joinPathFragments,
  Tree,
} from '@nrwl/devkit';

export interface CreateComponentSpecFileSchema {
  project: string;
  componentPath: string;
  js?: boolean;
  cypressProject?: string;
}

export function componentCypressGenerator(
  host: Tree,
  schema: CreateComponentSpecFileSchema
) {
  createComponentSpecFile(host, schema);
}

// TODO: candidate to refactor with the angular component story
export function getArgsDefaultValue(property: ts.SyntaxKind): string {
  const typeNameToDefault: Record<number, any> = {
    [ts.SyntaxKind.StringKeyword]: '',
    [ts.SyntaxKind.NumberKeyword]: 0,
    [ts.SyntaxKind.BooleanKeyword]: false,
  };

  const resolvedValue = typeNameToDefault[property];
  if (typeof resolvedValue === undefined) {
    return '';
  } else if (typeof resolvedValue === 'string') {
    return resolvedValue.replace(/\s/g, '+');
  } else {
    return resolvedValue;
  }
}

export function createComponentSpecFile(
  tree: Tree,
  { project, componentPath, js, cypressProject }: CreateComponentSpecFileSchema
) {
  const e2eProjectName = cypressProject || `${project}-e2e`;
  const projects = getProjects(tree);
  const e2eLibIntegrationFolderPath = `${
    projects.get(e2eProjectName).sourceRoot
  }/integration`;

  const proj = projects.get(project);
  const componentFilePath = joinPathFragments(proj.sourceRoot, componentPath);
  const componentName = componentFilePath
    .slice(componentFilePath.lastIndexOf('/') + 1)
    .replace('.tsx', '')
    .replace('.jsx', '')
    .replace('.js', '');

  const contents = tree.read(componentFilePath, 'utf-8');
  if (contents === null) {
    throw new Error(`Failed to read ${componentFilePath}`);
  }

  const sourceFile = ts.createSourceFile(
    componentFilePath,
    contents,
    ts.ScriptTarget.Latest,
    true
  );

  const cmpDeclaration = getComponentNode(sourceFile);
  if (!cmpDeclaration) {
    const componentNodes = findExportDeclarationsForJsx(sourceFile);
    if (componentNodes?.length) {
      componentNodes.forEach((declaration) => {
        findPropsAndGenerateFileForCypress(
          tree,
          sourceFile,
          declaration,
          e2eLibIntegrationFolderPath,
          componentName,
          project,
          js,
          true
        );
      });
    } else {
      throw new Error(
        `Could not find any React component in file ${componentFilePath}`
      );
    }
  } else {
    findPropsAndGenerateFileForCypress(
      tree,
      sourceFile,
      cmpDeclaration,
      e2eLibIntegrationFolderPath,
      componentName,
      project,
      js
    );
  }
}

function findPropsAndGenerateFileForCypress(
  tree: Tree,
  sourceFile: ts.SourceFile,
  cmpDeclaration: ts.Node,
  e2eLibIntegrationFolderPath: string,
  componentName: string,
  project: string,
  js: boolean,
  fromNodeArray?: boolean
) {
  const propsInterface = getComponentPropsInterface(sourceFile, cmpDeclaration);

  let props: {
    name: string;
    defaultValue: any;
  }[] = [];

  if (propsInterface) {
    props = propsInterface.members.map((member: ts.PropertySignature) => {
      return {
        name: (member.name as ts.Identifier).text,
        defaultValue: getArgsDefaultValue(member.type.kind),
      };
    });
  }

  generateFiles(
    tree,
    joinPathFragments(__dirname, './files'),
    `${e2eLibIntegrationFolderPath}/${
      fromNodeArray
        ? componentName + '--' + (cmpDeclaration as any).name.text
        : componentName
    }`,
    {
      projectName: project,
      componentName,
      componentSelector: (cmpDeclaration as any).name.text,
      props,
      fileExt: js ? 'js' : 'ts',
    }
  );
}

export default componentCypressGenerator;
export const componentCypressSchematic = convertNxGenerator(
  componentCypressGenerator
);
