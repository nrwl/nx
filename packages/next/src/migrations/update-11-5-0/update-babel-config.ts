import { chain, Rule, Tree } from '@angular-devkit/schematics';
import { getFullProjectGraphFromHost } from '@nrwl/workspace/src/utils/ast-utils';
import { formatFiles, updateJsonInTree } from '@nrwl/workspace';

export default function update(): Rule {
  return (host: Tree) => {
    const updates = [];
    const projectGraph = getFullProjectGraphFromHost(host);

    Object.keys(projectGraph.nodes).forEach((name) => {
      const p = projectGraph.nodes[name];

      const babelrcPath = `${p.data.root}/.babelrc`;
      if (!host.exists(babelrcPath)) return;

      updates.push(
        updateJsonInTree(babelrcPath, (json) => {
          json.presets = json.presets || [];
          json.presets = json.presets.map((x) =>
            x === 'next/babel' ? '@nrwl/next/babel' : x
          );
          return json;
        })
      );
    });

    updates.push(formatFiles());

    return chain(updates);
  };
}
