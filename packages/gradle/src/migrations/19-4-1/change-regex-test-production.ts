import { Tree, readNxJson, updateNxJson } from '@nx/devkit';
import { hasGradlePlugin } from '../../utils/has-gradle-plugin';

// This function changes !{projectRoot}/test/**/* in nx.json for production to !{projectRoot}/src/test/**/*
export default function update(tree: Tree) {
  if (!hasGradlePlugin(tree)) {
    return;
  }
  const nxJson = readNxJson(tree);
  if (!nxJson) {
    return;
  }
  const production = nxJson.namedInputs?.production;
  if (production?.includes('!{projectRoot}/test/**/*')) {
    production[production.indexOf('!{projectRoot}/test/**/*')] =
      '!{projectRoot}/src/test/**/*';
    updateNxJson(tree, nxJson);
  }
}
