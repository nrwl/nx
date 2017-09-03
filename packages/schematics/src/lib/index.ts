import {
  apply, branchAndMerge, chain, externalSchematic, mergeWith, move, Rule, template, Tree,
  url
} from '@angular-devkit/schematics';
import {Schema} from './schema';
import {names, toFileName} from '@nrwl/schematics';
import * as path from 'path';


export default function (options: Schema): Rule {
  const fullPath = path.join("libs", toFileName(options.name), options.sourceDir);

  const templateSource = apply(url('./files'), [
    template({
      ...names(options.name),
      dot: '.',
      tmpl: '',
      ...options as object
    })
  ]);

  return chain([
    branchAndMerge(chain([
      mergeWith(templateSource)
    ]))
  ]);
}
