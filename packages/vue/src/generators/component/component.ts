import {
  formatFiles,
  generateFiles,
  GeneratorCallback,
  runTasksInSerial,
  toJS,
  Tree,
} from '@nx/devkit';
import { NormalizedSchema, Schema } from './schema';
import { join } from 'path';
import { addExportsToBarrel, normalizeOptions } from './lib/utils';

export async function componentGenerator(host: Tree, schema: Schema) {
  return componentGeneratorInternal(host, {
    nameAndDirectoryFormat: 'derived',
    ...schema,
  });
}

export async function componentGeneratorInternal(host: Tree, schema: Schema) {
  const options = await normalizeOptions(host, schema);

  createComponentFiles(host, options);

  const tasks: GeneratorCallback[] = [];

  addExportsToBarrel(host, options);

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

function createComponentFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(host, join(__dirname, './files'), options.directory, {
    ...options,
    tmpl: '',
    unitTestRunner: options.unitTestRunner,
  });

  for (const c of host.listChanges()) {
    let deleteFile = false;

    if (
      (options.skipTests || options.inSourceTests) &&
      /.*spec.ts/.test(c.path)
    ) {
      deleteFile = true;
    }

    if (deleteFile) {
      host.delete(c.path);
    }
  }

  if (options.js) toJS(host);
}

export default componentGenerator;
