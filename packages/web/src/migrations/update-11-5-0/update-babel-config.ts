import { chain, Rule, Tree } from '@angular-devkit/schematics';
import { getFullProjectGraphFromHost } from '@nrwl/workspace/src/utils/ast-utils';
import { formatFiles, updateJsonInTree } from '@nrwl/workspace';

export default function update(): Rule {
  return (host: Tree) => {
    const updates = [];
    const projectGraph = getFullProjectGraphFromHost(host);

    if (host.exists('babel.config.json')) {
      updates.push(
        updateJsonInTree('babel.config.json', (json) => {
          if (Array.isArray(json.presets)) {
            json.presets = json.presets.filter((x) => x !== '@nrwl/web/babel');
          }
          return json;
        })
      );
    }

    Object.keys(projectGraph.nodes).forEach((name) => {
      const p = projectGraph.nodes[name];
      const babelrcPath = `${p.data.root}/.babelrc`;

      if (host.exists(babelrcPath)) {
        updates.push(
          updateJsonInTree(babelrcPath, (json) => {
            json.presets = json.presets || [];
            if (
              json.presets.findIndex(
                (x) =>
                  x === '@nrwl/web/babel' ||
                  x === '@nrwl/react/babel' ||
                  x === '@nrwl/gatsby/babel'
              )
            ) {
              json.presets.push('@nrwl/web/babel');
            }
            return json;
          })
        );
        // Non-buildable libraries might be included in applications that
        // require .babelrc to exist and contain '@nrwl/web/babel' preset
      } else if (p.data.projectType === 'library') {
        updates.push((host: Tree) => {
          host.create(
            babelrcPath,
            JSON.stringify({ presets: ['@nrwl/web/babel'] }, null, 2)
          );
        });
      }
    });

    updates.push(formatFiles());

    return chain(updates);
  };
}
