import {
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getProjects,
  joinPathFragments,
  runTasksInSerial,
  toJS,
  Tree,
} from '@nx/devkit';
import { NormalizedSchema, Schema } from './schema';
import { join } from 'path';
import { addExportsToBarrel, normalizeOptions } from './lib/utils';

export async function componentGenerator(host: Tree, schema: Schema) {
  const workspace = getProjects(host);
  const isApp = workspace.get(schema.project).projectType === 'application';

  const options = await normalizeOptions(host, schema, isApp);

  createComponentFiles(host, options);

  const tasks: GeneratorCallback[] = [];

  addExportsToBarrel(host, options, isApp);

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

function createComponentFiles(host: Tree, options: NormalizedSchema) {
  const componentDir = joinPathFragments(
    options.projectSourceRoot,
    options.directory
  );

  generateFiles(host, join(__dirname, './files'), componentDir, {
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
