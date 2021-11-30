import { chain, noop, Rule, Tree } from '@angular-devkit/schematics';
import { formatFiles, readWorkspace, updateJsonInTree } from '@nrwl/workspace';
import * as path from 'path';

const ignore = require('ignore');

export default function update(): Rule {
  return (host: Tree) => {
    const workspace = readWorkspace(host);
    return chain([
      ...Object.keys(workspace.projects).map((k) => {
        const p = workspace.projects[k];
        if (p.projectType !== 'application') {
          return noop();
        }
        if (isReactProject(p)) {
          return updateJsonInTree(
            path.join(p.root, 'tsconfig.json'),
            (json) => {
              json.files = json.files.filter(
                (f) => f.indexOf('@nrwl/react/typings/svg.d.ts') === -1
              );
              return json;
            }
          );
        } else {
          return noop();
        }
      }),
      formatFiles(),
    ]);
  };
}

function isReactProject(p) {
  const buildArchitect =
    p.architect && p.architect.build ? p.architect.build : null;
  return (
    buildArchitect &&
    (buildArchitect.builder === '@nrwl/web:build' ||
      buildArchitect.builder === '@nrwl/web:webpack') &&
    (buildArchitect.options.webpackConfig === '@nrwl/react/plugins/babel' ||
      buildArchitect.options.webpackConfig === '@nrwl/react/plugins/webpack')
  );
}
