import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  Tree,
} from '@nx/devkit';
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
  const specExt = options.js ? 'js' : 'ts';
  generateFiles(host, join(__dirname, './files'), options.directory, {
    ...options,
    isTs: !options.js,
    specExt,
    tmpl: '',
  });

  if (options.skipTests || options.inSourceTests) {
    host.delete(
      joinPathFragments(
        options.directory,
        `${options.fileName}.spec.${specExt}`
      )
    );
  }
}

export default componentGenerator;
