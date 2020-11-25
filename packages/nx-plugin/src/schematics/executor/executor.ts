import { chain, Rule, Tree } from '@angular-devkit/schematics';
import { addFiles } from './lib/add-files';
import { normalizeOptions } from './lib/normalize-options';
import { updateExecutorJson } from './lib/update-executor-json';
import { NormalizedSchema } from './schema';

export default function (schema: NormalizedSchema): Rule {
  return (host: Tree) => {
    const options = normalizeOptions(host, schema);

    return chain([addFiles(options), updateExecutorJson(host, options)]);
  };
}
