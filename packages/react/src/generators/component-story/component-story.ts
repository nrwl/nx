import {
  formatFiles,
  generateFiles,
  getProjects,
  joinPathFragments,
  normalizePath,
  Tree,
} from '@nx/devkit';
import type * as ts from 'typescript';
import {
  findExportDeclarationsForJsx,
  getComponentNode,
} from '../../utils/ast-utils';
import { getComponentPropDefaults } from '../../utils/component-props';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';

let tsModule: typeof import('typescript');

export interface CreateComponentStoriesFileSchema {
  project: string;
  componentPath: string;
  interactionTests?: boolean;
  skipFormat?: boolean;
}

export function createComponentStoriesFile(
  host: Tree,
  { project, componentPath, interactionTests }: CreateComponentStoriesFileSchema
) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const proj = getProjects(host).get(project);
  const sourceRoot = proj.sourceRoot;

  const componentFilePath = joinPathFragments(sourceRoot, componentPath);

  const componentDirectory = componentFilePath.replace(
    componentFilePath.slice(componentFilePath.lastIndexOf('/')),
    ''
  );

  const isPlainJs =
    componentFilePath.endsWith('.jsx') || componentFilePath.endsWith('.js');

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

  const sourceFile = tsModule.createSourceFile(
    componentFilePath,
    contents,
    tsModule.ScriptTarget.Latest,
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
          interactionTests,
          isPlainJs,
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
      interactionTests,
      isPlainJs
    );
  }
}

export function findPropsAndGenerateFile(
  host: Tree,
  sourceFile: ts.SourceFile,
  cmpDeclaration: ts.Node,
  componentDirectory: string,
  name: string,
  interactionTests: boolean,
  isPlainJs: boolean,
  fromNodeArray?: boolean
) {
  const { props, argTypes } = getComponentPropDefaults(
    sourceFile,
    cmpDeclaration
  );

  generateFiles(
    host,
    joinPathFragments(__dirname, `./files${isPlainJs ? '/jsx' : '/tsx'}`),
    normalizePath(componentDirectory),
    {
      tmpl: '',
      componentFileName: fromNodeArray
        ? `${name}--${(cmpDeclaration as any).name.text}`
        : name,
      componentImportFileName: name,
      props,
      argTypes,
      componentName: (cmpDeclaration as any).name.text,
      interactionTests,
    }
  );
}

export async function componentStoryGenerator(
  host: Tree,
  schema: CreateComponentStoriesFileSchema
) {
  createComponentStoriesFile(host, {
    ...schema,
    interactionTests: schema.interactionTests ?? true,
  });

  if (!schema.skipFormat) {
    await formatFiles(host);
  }
}

export default componentStoryGenerator;
