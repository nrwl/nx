import { chain, Tree, noop } from '@angular-devkit/schematics';
import { addUpdateTask, readJsonInTree, formatFiles } from '@nrwl/workspace';

const runNgrxUpdate = addUpdateTask('@ngrx/store', '8.1.0');

const updateNgrx = (host: Tree) => {
  const { dependencies } = readJsonInTree(host, 'package.json');

  if (dependencies && dependencies['@ngrx/store']) {
    return chain([runNgrxUpdate, formatFiles()]);
  }

  return noop();
};

export default function() {
  return chain([updateNgrx]);
}
