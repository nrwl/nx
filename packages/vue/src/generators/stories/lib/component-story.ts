import {
  generateFiles,
  joinPathFragments,
  normalizePath,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { getProjectSourceRoot } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { StorybookStoriesSchema } from '../stories';
import {
  camelCase,
  createDefautPropsObject,
  getDefinePropsObject,
} from './utils';
import { join } from 'path';

let tsModule: typeof import('typescript');

export function createComponentStories(
  host: Tree,
  { project, js, interactionTests }: StorybookStoriesSchema,
  componentPath: string
) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const proj = readProjectConfiguration(host, project);
  const sourceRoot = getProjectSourceRoot(proj);

  const componentFilePath = joinPathFragments(sourceRoot, componentPath);

  const componentDirectory = componentFilePath.replace(
    componentFilePath.slice(componentFilePath.lastIndexOf('/')),
    ''
  );

  const componentFileName = componentFilePath
    .slice(componentFilePath.lastIndexOf('/') + 1)
    .replace('.vue', '');

  const name = componentFileName;
  const contents = host.read(componentFilePath, 'utf-8');
  const propsObject = getDefinePropsObject(contents);

  generateFiles(
    host,
    join(__dirname, `./files${js ? '/js' : '/ts'}`),
    normalizePath(componentDirectory),
    {
      tmpl: '',
      componentFileName: name,
      componentImportFileName: `${name}.vue`,
      props: createDefautPropsObject(propsObject),
      componentName: camelCase(name),
      interactionTests,
    }
  );
  if (contents === null) {
    throw new Error(`Failed to read ${componentFilePath}`);
  }
}
