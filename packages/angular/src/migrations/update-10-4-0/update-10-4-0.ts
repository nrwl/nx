import { normalize, Path } from '@angular-devkit/core';
import { ProjectDefinition } from '@angular-devkit/core/src/workspace';
import { chain, Rule, Tree } from '@angular-devkit/schematics';
import {
  formatFiles,
  getWorkspace,
  updateJsonInTree,
  updatePackagesInPackageJson,
} from '@nrwl/workspace';
import { join as pathJoin } from 'path';
import { offsetFromRoot } from '@nrwl/devkit';

function updateBaseConfig(project: ProjectDefinition, baseConfig: Path): Rule {
  return updateJsonInTree(baseConfig, (json) => {
    return {
      ...json,
      extends: `${offsetFromRoot(project.root)}tsconfig.base.json`,
    };
  });
}

async function udpateProtractorTsConfig(host: Tree) {
  const workspace = await getWorkspace(host);
  const rules = [];

  workspace.projects.forEach((project) => {
    project.targets.forEach((target) => {
      if (target.builder === '@angular-devkit/build-angular:protractor') {
        rules.push(
          updateBaseConfig(project, normalize(`${project.root}/tsconfig.json`))
        );
      }
    });
  });
  return chain(rules);
}

export default function () {
  return chain([
    updatePackagesInPackageJson(
      pathJoin(__dirname, '../../../migrations.json'),
      '10.4.0'
    ),
    udpateProtractorTsConfig,
    formatFiles(),
  ]);
}
