import {
  generateFiles,
  getProjects,
  joinPathFragments,
  normalizePath,
  Tree,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { StorybookStoriesSchema } from '../stories';
import {
  camelCase,
  createDefautPropsObject,
  getDefinePropsObject,
} from './utils';

let tsModule: typeof import('typescript');

export function createComponentStories(
  host: Tree,
  { project, js, interactionTests }: StorybookStoriesSchema,
  componentPath: string
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

  const componentFileName = componentFilePath
    .slice(componentFilePath.lastIndexOf('/') + 1)
    .replace('.vue', '');

  const name = componentFileName;
  const contents = host.read(componentFilePath, 'utf-8');
  const propsObject = getDefinePropsObject(contents);

  generateFiles(
    host,
    joinPathFragments(__dirname, `./files${js ? '/js' : '/ts'}`),
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
