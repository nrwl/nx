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
  getComponentName,
  getComponentPropsInterface,
} from '@nrwl/react/src/utils/ast-utils';
import { getArgsDefaultValue } from '@nrwl/react/src/generators/component-story/component-story';

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

  const componentFileName = componentFilePath
    .slice(componentFilePath.lastIndexOf('/') + 1)
    .replace('.tsx', '');

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

  const cmpDeclaration = getComponentName(sourceFile);

  if (!cmpDeclaration) {
    throw new Error(
      `Could not find any React component in file ${componentFilePath}`
    );
  }

  const propsInterface = getComponentPropsInterface(sourceFile);

  let propsTypeName: string = null;
  let props: {
    name: string;
    defaultValue: any;
  }[] = [];
  let argTypes: {
    name: string;
    type: string;
    actionText: string;
  }[] = [];

  if (propsInterface) {
    propsTypeName = propsInterface.name.text;
    props = propsInterface.members.map((member: ts.PropertySignature) => {
      if (member.type.kind === ts.SyntaxKind.FunctionType) {
        argTypes.push({
          name: (member.name as ts.Identifier).text,
          type: 'action',
          actionText: `${(member.name as ts.Identifier).text} executed!`,
        });
      } else {
        return {
          name: (member.name as ts.Identifier).text,
          defaultValue: getArgsDefaultValue(member.type.kind),
        };
      }
    });
    props = props.filter((p) => p && p.defaultValue !== undefined);
  }

  generateFiles(
    host,
    joinPathFragments(__dirname, './files'),
    normalizePath(componentDirectory),
    {
      componentFileName: name,
      componentName: (cmpDeclaration as any).name.text,
      propsTypeName,
      props,
      argTypes,
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
