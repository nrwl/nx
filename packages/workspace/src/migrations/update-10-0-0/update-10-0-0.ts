import { chain } from '@angular-devkit/schematics';
import { updateJsonInTree } from '../../utils/ast-utils';
import { NxJson } from '../../core/shared-interfaces';

const addNxJsonAffectedConfig = updateJsonInTree('nx.json', (json: NxJson) => {
  json.affected = {
    defaultBase: 'master',
  };

  return json;
});

export default function () {
  return chain([addNxJsonAffectedConfig]);
}
