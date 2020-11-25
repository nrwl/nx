import { Schema } from './schema';
import { toFileName } from '@nrwl/workspace';
import { Tree, formatFiles, generateFiles } from '@nrwl/devkit';
import * as path from 'path';

export default async function (host: Tree, schema: Schema) {
  const options = normalizeOptions(schema);
  generateFiles(
    host,
    path.join(__dirname, 'files'),
    path.join('tools/generators', schema.name),
    options
  );
  if (!schema.skipFormat) {
    await formatFiles(host);
  }
}

function normalizeOptions(options: Schema): any {
  const name = toFileName(options.name);
  return { ...options, name, tmpl: '' };
}
