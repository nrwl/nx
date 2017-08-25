import {apply, chain, mergeWith, move, Rule, schematic, template, url,} from '@angular-devkit/schematics';
import {Schema} from './schema';
import {names} from '../name-utils';

export default function(options: Schema): Rule {
  return chain([mergeWith(apply(
      url('./files'), [template({...options, ...names(options.name), 'dot': '.', 'tmpl': ''}), move(options.name!)]))]);
}
