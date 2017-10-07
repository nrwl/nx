import { apply, branchAndMerge, chain, mergeWith, Rule, template, Tree, url } from '@angular-devkit/schematics';
import { Schema } from './schema';
import * as path from 'path';
import { names, toFileName } from '@nrwl/schematics';

function addLibToAngularCliJson(fullPath: string, schema: Schema): Rule {
  return (host: Tree) => {
    const source = JSON.parse(host.read('.angular-cli.json')!.toString('utf-8'));
    source.apps.push({ name: schema.name, root: fullPath, appDir: false });
    host.overwrite('.angular-cli.json', JSON.stringify(source, null, 2));
    return host;
  };
}

export default function(options: any): Rule {
  const fullPath = path.join(options.directory, toFileName(options.name), options.sourceDir);

  const templateSource = apply(url('./files'), [template({ ...options, ...names(options.name), dot: '.', tmpl: '' })]);

  return chain([branchAndMerge(chain([mergeWith(templateSource), addLibToAngularCliJson(fullPath, options)]))]);
}
