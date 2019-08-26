import { chain, Tree, noop, TaskId } from '@angular-devkit/schematics';
import { addUpdateTask, readJsonInTree, formatFiles } from '@nrwl/workspace';

const updateCLI = addUpdateTask('@angular/cli', '8.3.2');

function updateNgrx() {
  return (host: Tree) => {
    const { dependencies } = readJsonInTree(host, 'package.json');

    if (dependencies && dependencies['@ngrx/store']) {
      return chain([addUpdateTask('@ngrx/store', '8.3.0'), formatFiles()]);
    }

    return noop();
  };
}

export default function() {
  return chain([updateCLI, updateNgrx()]);
}
