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
} from '../../utils/ast-utils';

export interface CreateComponentStoriesFileSchema {
  project: string;
  componentPath: string;
}

export type KnobType = 'text' | 'boolean' | 'number' | 'select';

// TODO: candidate to refactor with the angular component story
export function getKnobDefaultValue(property: ts.SyntaxKind): string {
  const typeNameToDefault: Record<number, any> = {
    [ts.SyntaxKind.StringKeyword]: "''",
    [ts.SyntaxKind.NumberKeyword]: 0,
    [ts.SyntaxKind.BooleanKeyword]: false,
  };

  const resolvedValue = typeNameToDefault[property];
  if (typeof resolvedValue === undefined) {
    return "''";
  } else {
    return resolvedValue;
  }
}

export function createComponentStoriesFile(
  host: Tree,
  {
    // name,
    project,
    componentPath,
  }: CreateComponentStoriesFileSchema
) {
  const proj = getProjects(host).get(project);
  const sourceRoot = proj.sourceRoot;

  // TODO: Remove this entirely, given we don't support TSLint with React?
  const usesEsLint = true;

  const componentFilePath = joinPathFragments(sourceRoot, componentPath);
  const componentDirectory = componentFilePath.replace(
    componentFilePath.slice(componentFilePath.lastIndexOf('/')),
    ''
  );

  const isPlainJs = componentFilePath.endsWith('.jsx');
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

  const contents = host.read(componentFilePath);
  if (!contents) {
    throw new Error(`Failed to read ${componentFilePath}`);
  }

  const sourceFile = ts.createSourceFile(
    componentFilePath,
    contents.toString(),
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
    type: KnobType;
    defaultValue: any;
  }[] = [];

  if (propsInterface) {
    propsTypeName = propsInterface.name.text;

    props = propsInterface.members.map((member: ts.PropertySignature) => {
      const initializerKindToKnobType: Record<number, KnobType> = {
        [ts.SyntaxKind.StringKeyword]: 'text',
        [ts.SyntaxKind.NumberKeyword]: 'number',
        [ts.SyntaxKind.BooleanKeyword]: 'boolean',
      };

      return {
        name: (member.name as ts.Identifier).text,
        type: initializerKindToKnobType[member.type.kind],
        defaultValue: getKnobDefaultValue(member.type.kind),
      };
    });
  }

  generateFiles(
    host,
    joinPathFragments(__dirname, './files'),
    normalizePath(componentDirectory),
    {
      componentFileName: name,
      propsTypeName,
      props,
      usedKnobs: props.map((x) => x.type).join(', '),
      componentName: (cmpDeclaration as any).name.text,
      isPlainJs,
      fileExt,
      usesEsLint,
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
