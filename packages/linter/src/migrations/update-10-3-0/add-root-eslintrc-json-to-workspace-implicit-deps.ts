import { chain, noop, Tree } from '@angular-devkit/schematics';
import { formatFiles, updateJsonInTree } from '@nrwl/workspace';

function addRootESLintrcToImplicitDependencies(host: Tree) {
  return host.exists('nx.json')
    ? updateJsonInTree('nx.json', (json) => {
        json.implicitDependencies ||= {};
        json.implicitDependencies['.eslintrc.json'] = '*';
        return json;
      })
    : noop();
}

export default function () {
  return chain([addRootESLintrcToImplicitDependencies, formatFiles()]);
}
