import { chain, Rule, Tree } from '@angular-devkit/schematics';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { addFiles } from './lib/add-files';
import { normalizeOptions } from './lib/normalize-options';
import { updateExecutorJson } from './lib/update-executor-json';
import { NormalizedSchema } from './schema';

export function executorSchematic(schema: NormalizedSchema): Rule {
  return (host: Tree) => {
    const options = normalizeOptions(host, schema);

    return chain([addFiles(options), updateExecutorJson(host, options)]);
  };
}

export default executorSchematic;
export const executorGenerator = wrapAngularDevkitSchematic(
  '@nrwl/nx-plugin',
  'executor'
);
