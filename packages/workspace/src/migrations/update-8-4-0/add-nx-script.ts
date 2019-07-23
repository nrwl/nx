import { updateJsonInTree } from '../../utils/ast-utils';

const addNxScript = updateJsonInTree('package.json', json => {
  if (json.scripts && !json.scripts.nx) {
    json.scripts.nx = 'nx';
  }
  return json;
});

export default function() {
  return addNxScript;
}
