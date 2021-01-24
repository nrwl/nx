import { Schema } from './schema';
import {
  Tree,
  formatFiles,
  generateFiles,
  names,
  joinPathFragments,
} from '@nrwl/devkit';

export default async function (host: Tree, schema: Schema) {
  const options = normalizeOptions(schema);
  generateFiles(
    host,
    joinPathFragments(__dirname, 'files'),
    joinPathFragments('tools/generators', schema.name),
    options
  );
  if (!schema.skipFormat) {
    await formatFiles(host);
  }
}

function normalizeOptions(options: Schema): any {
  const name = names(options.name).fileName;
  return { ...options, name, tmpl: '' };
}
