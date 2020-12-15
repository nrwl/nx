import { chain, Rule } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import {
  readWorkspace,
  updateJsonInTree,
  updateWorkspaceInTree,
} from '@nrwl/workspace';

/**
 * If no more instances of @angular-devkit/build-angular:tslint
 * are found within the user's workspace, we can remove the relevant
 * TSLint dependencies and any applicable global config.
 */
export function removeTSLintIfNoMoreTSLintTargets(
  rootTSLintJsonPath: string
): Rule {
  return (tree, context) => {
    const workspaceJSON = readWorkspace(tree);

    for (const projectName of Object.keys(workspaceJSON.projects)) {
      const targets =
        workspaceJSON.projects[projectName].targets ||
        workspaceJSON.projects[projectName].architect;

      for (const [_, targetConfig] of Object.entries(targets)) {
        const executor =
          (targetConfig as any).executor || (targetConfig as any).builder;
        if (executor === '@angular-devkit/build-angular:tslint') {
          // Workspace is still using TSLint, exit early
          return;
        }
      }
    }

    // If we got this far the user has no remaining TSLint usage

    tree.delete(rootTSLintJsonPath);

    const depsToRemove = ['tslint', 'codelyzer'];

    return chain([
      updateJsonInTree('package.json', (json) => {
        let hasChanges = false;
        depsToRemove.forEach((depName) => {
          if (json.dependencies?.[depName]) {
            delete json.dependencies[depName];
            hasChanges = true;
          }
          if (json.devDependencies?.[depName]) {
            delete json.devDependencies[depName];
            hasChanges = true;
          }
        });
        if (hasChanges) {
          context.addTask(new NodePackageInstallTask());
        }
        return json;
      }),
      updateWorkspaceInTree((json) => {
        json.schematics = json.schematics || {};

        /**
         * At the time of creating this schematic, ESLint is not the default for Angular
         * projects, and the "linter" property is not configured in the JSON, so we need
         * to explicitly make sure the relevant config is included.
         */
        json.schematics['@nrwl/angular:application'] =
          json.schematics['@nrwl/angular:application'] || {};
        json.schematics['@nrwl/angular:application'].linter = 'eslint';

        json.schematics['@nrwl/angular:library'] =
          json.schematics['@nrwl/angular:library'] || {};
        json.schematics['@nrwl/angular:library'].linter = 'eslint';

        function isJSONObjectLiteral(o: unknown) {
          return Boolean(o && o.constructor === Object);
        }

        function recursivelyCheckForAndUpdateLinter(configProp, config) {
          const maybeNestedConfigObj = config[configProp];

          if (isJSONObjectLiteral(maybeNestedConfigObj)) {
            for (const nestedConfigProp of Object.keys(maybeNestedConfigObj)) {
              recursivelyCheckForAndUpdateLinter(
                nestedConfigProp,
                maybeNestedConfigObj
              );
            }
          }

          if (configProp !== 'linter') {
            return;
          }
          config[configProp] = 'eslint';
        }

        for (const [, config] of Object.entries(json.schematics)) {
          for (const configProp of Object.keys(config)) {
            recursivelyCheckForAndUpdateLinter(configProp, config);
          }
        }

        return json;
      }),
    ]);
  };
}
