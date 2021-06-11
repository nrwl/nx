import {
  apply,
  chain,
  mergeWith,
  move,
  Rule,
  template,
  Tree,
  url,
} from '@angular-devkit/schematics';
import {
  formatFiles,
  getWorkspace,
  readJsonInTree,
  updateJsonInTree,
  updatePackagesInPackageJson,
} from '@nrwl/workspace';
import { ProjectDefinition } from '@angular-devkit/core/src/workspace';
import { join as pathJoin } from 'path';

import {
  dirname,
  join,
  normalize,
  Path,
  relative,
  resolve,
} from '@angular-devkit/core';

function relativePath(path1: Path, path2: Path) {
  let path = relative(
    resolve(normalize('/'), normalize(path1)),
    resolve(normalize('/'), path2)
  );
  if (!path.startsWith('../')) {
    path = `./${path}` as Path;
  }
  return path;
}

function createEditorTsConfig(
  project: ProjectDefinition,
  baseConfig: Path | null
): Rule {
  let usesJest = false;
  let usesKarma = false;
  for (let [_, targetConfig] of project.targets) {
    if (targetConfig.builder === '@nrwl/jest:jest') {
      usesJest = usesJest || true;
    } else if (targetConfig.builder === '@angular-devkit/build-angular:karma') {
      usesKarma = usesKarma || true;
    }
  }
  let relativeBaseConfigPath = baseConfig
    ? relativePath(normalize(project.root), baseConfig)
    : null;

  return mergeWith(
    apply(url('./files'), [
      template({
        usesJest,
        usesKarma,
        baseConfigPath: relativeBaseConfigPath,
      }),
      move(project.root),
    ])
  );
}

function updateBaseConfig(project: ProjectDefinition, baseConfig: Path): Rule {
  return updateJsonInTree(baseConfig, (json) => {
    json.references.push({
      path: relativePath(
        dirname(baseConfig),
        join(normalize(project.root), 'tsconfig.editor.json')
      ),
    });
    return json;
  });
}

async function createEditorTsConfigs(host: Tree) {
  const workspace = await getWorkspace(host);
  const rules = [];
  workspace.projects.forEach((project) => {
    project.targets.forEach((target) => {
      if (target.builder === '@angular-devkit/build-angular:browser') {
        const baseConfig = target.options?.tsConfig
          ? resolve(
              dirname(normalize(target.options.tsConfig as string)),
              readJsonInTree(host, target.options.tsConfig as string).extends
            )
          : null;
        if (
          baseConfig &&
          !Array.isArray(readJsonInTree(host, baseConfig).references)
        ) {
          return;
        }
        rules.push(createEditorTsConfig(project, baseConfig));
        if (baseConfig) {
          rules.push(updateBaseConfig(project, baseConfig));
        }
      }
    });
  });
  return chain(rules);
}

export default function () {
  return chain([
    updatePackagesInPackageJson(
      pathJoin(__dirname, '../../../migrations.json'),
      '10.3.0'
    ),
    createEditorTsConfigs,
    formatFiles(),
  ]);
}
