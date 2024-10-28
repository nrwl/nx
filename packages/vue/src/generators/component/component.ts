import { formatFiles, generateFiles, toJS, Tree } from '@nx/devkit';
import { join } from 'path';
import { addExportsToBarrel, normalizeOptions } from './lib/utils';
import { NormalizedSchema, ComponentGeneratorSchema } from './schema';

export async function componentGenerator(
  host: Tree,
  schema: ComponentGeneratorSchema
) {
  const options = await normalizeOptions(host, schema);

  createComponentFiles(host, options);
  addExportsToBarrel(host, options);

  if (!options.skipFormat) {
    await formatFiles(host);
  }
}

function createComponentFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(host, join(__dirname, './files'), options.directory, {
    ...options,
    tmpl: '',
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
