import { Schema } from './schema';
import { toFileName } from '@nrwl/workspace';
import { Tree, formatFiles, generateFiles } from '@nrwl/devkit';
import * as path from 'path';

export default function (schema: Schema) {
  const options = normalizeOptions(schema);

  return async (host: Tree) => {
    generateFiles(
      path.join(__dirname, 'files'),
      path.join('tools/schematics', schema.name),
      options
    )(host);
    if (!schema.skipFormat) {
      await formatFiles(host);
    }
  };
}

function normalizeOptions(options: Schema): any {
  const name = toFileName(options.name);
  return { ...options, name, tmpl: '' };
}
