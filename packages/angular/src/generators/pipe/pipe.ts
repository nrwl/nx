import type { ProjectConfiguration, Tree } from '@nrwl/devkit';
import {
  formatFiles,
  generateFiles,
  getProjects,
  joinPathFragments,
  names,
  readProjectConfiguration,
} from '@nrwl/devkit';
import type { Schema } from './schema';
import { checkPathUnderProjectRoot } from '../utils/path';
import { addToNgModule, findModule } from '../utils';

let tsModule: typeof import('typescript');

export async function pipeGenerator(tree: Tree, schema: Schema) {
  const projects = getProjects(tree);
  if (!projects.has(schema.project)) {
    throw new Error(`Project "${schema.project}" does not exist!`);
  }

  checkPathUnderProjectRoot(tree, schema.project, schema.path);

  const project = readProjectConfiguration(
    tree,
    schema.project
  ) as ProjectConfiguration & { prefix?: string };

  const path = schema.path ?? `${project.sourceRoot}`;
  const pipeNames = names(schema.name);

  const pathToGenerateFiles = schema.flat
    ? './files/__pipeFileName__'
    : './files';
  await generateFiles(
    tree,
    joinPathFragments(__dirname, pathToGenerateFiles),
    path,
    {
      pipeClassName: pipeNames.className,
      pipeFileName: pipeNames.fileName,
      pipePropertyName: pipeNames.propertyName,
      standalone: schema.standalone,
      tpl: '',
    }
  );

  if (schema.skipTests) {
    const pathToSpecFile = joinPathFragments(
      path,
      `${!schema.flat ? `${pipeNames.fileName}/` : ``}${
        pipeNames.fileName
      }.pipe.spec.ts`
    );

    tree.delete(pathToSpecFile);
  }

  if (!schema.skipImport && !schema.standalone) {
    const modulePath = findModule(tree, path, schema.module);
    addToNgModule(
      tree,
      path,
      modulePath,
      pipeNames.fileName,
      `${pipeNames.className}Pipe`,
      `${pipeNames.fileName}.pipe`,
      'declarations',
      schema.flat,
      schema.export
    );
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
}

export default pipeGenerator;
