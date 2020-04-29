import { chain, Tree, noop, TaskId } from '@angular-devkit/schematics';
import {
  addUpdateTask,
  readJsonInTree,
  formatFiles,
  updateJsonInTree,
  checkAndCleanWithSemver,
  addInstallTask,
} from '@nrwl/workspace';
import { gt } from 'semver';

function updateCLI() {
  const tasks: TaskId[] = [];
  const rule = chain([
    updateJsonInTree('package.json', (json) => {
      json.devDependencies = json.devDependencies || {};
      const cliVersion = json.devDependencies['@angular/cli'];
      const cleanCliVersion = checkAndCleanWithSemver(
        '@angular/cli',
        cliVersion
      );

      if (cleanCliVersion && gt(cleanCliVersion, '8.1.1')) {
        return json;
      }

      if (json['devDependencies']['@angular/cli']) {
        json['devDependencies']['@angular/cli'] = '8.1.1';
      }

      if (json['devDependencies']['@angular-devkit/build-angular']) {
        json['devDependencies']['@angular-devkit/build-angular'] = '^0.801.1';
      }

      if (json['devDependencies']['@angular-devkit/build-ng-packagr']) {
        json['devDependencies']['@angular-devkit/build-ng-packagr'] =
          '~0.801.1';
      }

      return json;
    }),
    addInstallTask(),
  ]);

  return { rule, tasks };
}

function updateNgrx(updateDeps: TaskId[]) {
  return (host: Tree) => {
    const { dependencies } = readJsonInTree(host, 'package.json');

    if (dependencies && dependencies['@ngrx/store']) {
      return chain([
        addUpdateTask('@ngrx/store', '8.1.0', updateDeps),
        formatFiles(),
      ]);
    }

    return noop();
  };
}

export default function () {
  const { rule: updateCLIRule, tasks } = updateCLI();
  return chain([updateCLIRule, updateNgrx(tasks), formatFiles()]);
}
