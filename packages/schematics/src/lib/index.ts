import {
  apply,
  branchAndMerge,
  chain,
  externalSchematic,
  mergeWith,
  move,
  Rule,
  template,
  Tree,
  url
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import { names, toFileName } from '@nrwl/schematics';
import * as path from 'path';
import { addApp } from '../utility/config-file-utils';

function addLibToAngularCliJson(options: Schema): Rule {
  return (host: Tree) => {
    if (!host.exists('.angular-cli.json')) {
      throw new Error('Missing .angular-cli.json');
    }

    const sourceText = host.read('.angular-cli.json')!.toString('utf-8');
    const json = JSON.parse(sourceText);
    json.apps = addApp(json.apps, {
      name: options.name,
      root: fullPath(options),
      test: '../../../test.js',
      appRoot: ''
    });

    host.overwrite('.angular-cli.json', JSON.stringify(json, null, 2));
    return host;
  };
}

export default function(schema: Schema): Rule {
  const options = { ...schema, name: toFileName(schema.name) };
  const fullPath = path.join('libs', toFileName(options.name), options.sourceDir);

  const templateSource = apply(url(options.ngmodule ? './ngfiles' : './files'), [
    template({
      ...names(options.name),
      dot: '.',
      tmpl: '',
      ...(options as object)
    })
  ]);

  return chain([branchAndMerge(chain([mergeWith(templateSource)])), addLibToAngularCliJson(options)]);
}

function fullPath(options: Schema) {
  return path.join('libs', options.name, options.sourceDir);
}
