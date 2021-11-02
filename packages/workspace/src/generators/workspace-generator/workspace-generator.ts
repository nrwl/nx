import { Schema } from './schema';
import {
  Tree,
  formatFiles,
  generateFiles,
  names,
  joinPathFragments,
  addDependenciesToPackageJson,
} from '@nrwl/devkit';
import { nxVersion } from '../../utils/versions';

export default async function (host: Tree, schema: Schema) {
  const options = normalizeOptions(schema);

  generateFiles(
    host,
    joinPathFragments(__dirname, 'files'),
    joinPathFragments('tools/generators', schema.name),
    options
  );

  const installTask = addDependenciesToPackageJson(
    host,
    {},
    {
      '@nrwl/devkit': nxVersion,
    }
  );

  if (!schema.skipFormat) {
    await formatFiles(host);
  }
  return installTask;
}

function normalizeOptions(options: Schema): any {
  const name = names(options.name).fileName;
  return { ...options, name, tmpl: '' };
}
