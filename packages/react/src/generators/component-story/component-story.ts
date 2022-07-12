import {
  convertNxGenerator,
  formatFiles,
  generateFiles,
  getProjects,
  joinPathFragments,
  normalizePath,
  Tree,
} from '@nrwl/devkit';
import * as ts from 'typescript';
import {
  findExportDeclarationsForJsx,
  getComponentNode,
} from '../../utils/ast-utils';
import { getDefaultsForComponent } from '../../utils/component-props';

export interface CreateComponentStoriesFileSchema {
  project: string;
  componentPath: string;
}

export function createComponentStoriesFile(
  host: Tree,
  { project, componentPath }: CreateComponentStoriesFileSchema
) {
  const proj = getProjects(host).get(project);
  const sourceRoot = proj.sourceRoot;

  const componentFilePath = joinPathFragments(sourceRoot, componentPath);

  const componentDirectory = componentFilePath.replace(
    componentFilePath.slice(componentFilePath.lastIndexOf('/')),
    ''
  );

  const isPlainJs =
    componentFilePath.endsWith('.jsx') || componentFilePath.endsWith('.js');
  let fileExt = 'tsx';
  if (componentFilePath.endsWith('.jsx')) {
    fileExt = 'jsx';
  } else if (componentFilePath.endsWith('.js')) {
    fileExt = 'js';
  }

  const componentFileName = componentFilePath
    .slice(componentFilePath.lastIndexOf('/') + 1)
    .replace('.tsx', '')
    .replace('.jsx', '')
    .replace('.js', '');

  const name = componentFileName;

  const contents = host.read(componentFilePath, 'utf-8');
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
        findPropsAndGenerateFile(
          host,
          sourceFile,
          declaration,
          componentDirectory,
          name,
          isPlainJs,
          fileExt,
          componentNodes.length > 1
        );
      });
    } else {
      throw new Error(
        `Could not find any React component in file ${componentFilePath}`
      );
    }
  } else {
    findPropsAndGenerateFile(
      host,
      sourceFile,
      cmpDeclaration,
      componentDirectory,
      name,
      isPlainJs,
      fileExt
    );
  }
}

export function findPropsAndGenerateFile(
  host: Tree,
  sourceFile: ts.SourceFile,
  cmpDeclaration: ts.Node,
  componentDirectory: string,
  name: string,
  isPlainJs: boolean,
  fileExt: string,
  fromNodeArray?: boolean
) {
  const { propsTypeName, props, argTypes } = getDefaultsForComponent(
    sourceFile,
    cmpDeclaration
  );

  generateFiles(
    host,
    joinPathFragments(__dirname, './files'),
    normalizePath(componentDirectory),
    {
      componentFileName: fromNodeArray
        ? `${name}--${(cmpDeclaration as any).name.text}`
        : name,
      componentImportFileName: name,
      propsTypeName,
      props,
      argTypes,
      componentName: (cmpDeclaration as any).name.text,
      isPlainJs,
      fileExt,
    }
  );
}

export async function componentStoryGenerator(
  host: Tree,
  schema: CreateComponentStoriesFileSchema
) {
  createComponentStoriesFile(host, schema);
  await formatFiles(host);
}

export default componentStoryGenerator;
export const componentStorySchematic = convertNxGenerator(
  componentStoryGenerator
);
