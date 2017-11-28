import { apply, branchAndMerge, chain, mergeWith, move, Rule, template, Tree, url } from '@angular-devkit/schematics';
import { Schema } from './schema';
import * as stringUtils from '@schematics/angular/strings';
import { libVersions } from '../utility/lib-versions';

export default function(options: Schema): Rule {
  const npmScope = options.npmScope ? options.npmScope : options.name;
  const templateSource = apply(url('./files'), [
    template({
      utils: stringUtils,
      dot: '.',
      ...libVersions,
      ...(options as object),
      npmScope
    })
  ]);

  return chain([branchAndMerge(chain([mergeWith(templateSource)]))]);
}
