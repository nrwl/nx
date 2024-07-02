import { Tree, readNxJson } from '@nx/devkit';
import { hasGradlePlugin } from '../../utils/has-gradle-plugin';
import { updateNxJsonConfiguration } from '../../generators/init/init';

// This function changes !{projectRoot}/test/**/* in nx.json for production to !{projectRoot}/src/test/**/*
export default function update(tree: Tree) {
  if (!hasGradlePlugin(tree)) {
    return;
  }
  if (tree.exists('nx.json')) {
    const nxJson = readNxJson(tree);
    const production = nxJson?.namedInputs?.production;
    if (production?.includes('!{projectRoot}/test/**/*')) {
      production.splice(production.indexOf('!{projectRoot}/test/**/*'), 1);
      tree.write('nx.json', JSON.stringify(nxJson, null, 2));
    }
    updateNxJsonConfiguration(tree);
  }
}
