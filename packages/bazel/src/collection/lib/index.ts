import {branchAndMerge, chain, mergeWith, Rule,} from '@angular-devkit/schematics';

import {validateLibSchema} from '../../../../schematics/src/collection/lib';
import {wrapIntoFormat} from '../../../../schematics/src/utils/tasks';

import {Schema} from './schema';

export default function(schema: Schema): Rule {
  return wrapIntoFormat(() => {
    const {templateSource, routingRules} = validateLibSchema(schema);

    return chain(
        [branchAndMerge(chain([mergeWith(templateSource)])), ...routingRules]);
  });
}
