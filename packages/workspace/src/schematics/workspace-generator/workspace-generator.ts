import { Schema } from './schema';
import { Tree, formatFiles, generateFiles, names } from '@nrwl/devkit';
import * as path from 'path';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';

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
  const name = names(options.name).fileName;
  return { ...options, name, tmpl: '' };
}

export const workspaceGeneratorGenerator = wrapAngularDevkitSchematic(
  '@nrwl/workspace',
  'workspace-generator'
);
