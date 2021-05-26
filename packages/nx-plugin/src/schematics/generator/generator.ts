import { chain, Rule, Tree } from '@angular-devkit/schematics';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { addFiles } from './lib/add-files';
import { normalizeOptions } from './lib/normalize-options';
import { updateGeneratorJson } from './lib/update-generator-json';
import { NormalizedSchema } from './schema';

export function generatorSchematic(schema: NormalizedSchema): Rule {
  return (host: Tree) => {
    const options = normalizeOptions(host, schema);

    return chain([addFiles(host, options), updateGeneratorJson(host, options)]);
  };
}

export default generatorSchematic;
export const generatorGenerator = wrapAngularDevkitSchematic(
  '@nrwl/nx-plugin',
  'generator'
);
