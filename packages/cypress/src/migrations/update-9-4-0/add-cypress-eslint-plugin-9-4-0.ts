import { chain, Rule, Tree } from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  formatFiles,
  readJsonInTree,
  updateJsonInTree,
} from '@nrwl/workspace';

async function addCypressPluginToEslintrc(host: Tree) {
  const rules: Rule[] = [];
  const { devDependencies } = readJsonInTree(host, 'package.json');

  const eslintrcFilePaths = [];
  if (devDependencies && devDependencies['@nrwl/cypress']) {
    const workspaceJson = readJsonInTree(host, 'workspace.json');
    Object.values<any>(workspaceJson.projects).forEach((project) => {
      Object.values<any>(project.architect).forEach((target) => {
        if (target.builder !== '@nrwl/cypress:cypress') {
          return;
        }

        if (host.exists(`${project.root}/.eslintrc`)) {
          eslintrcFilePaths.push(`${project.root}/.eslintrc`);
        }
      });
    });

    eslintrcFilePaths.forEach((eslintrcFilePath) => {
      rules.push(
        updateJsonInTree(eslintrcFilePath as string, (json) => {
          if (json.extends) {
            if (!Array.isArray(json.extends)) {
              json.extends = [json.extends];
            }

            json.extends.push('plugin:cypress/recommended');
          }

          return json;
        })
      );
    });
  }

  return chain(rules);
}

export default () => {
  return chain([
    addDepsToPackageJson({}, { 'eslint-plugin-cypress': '^2.10.3' }),
    addCypressPluginToEslintrc,
    formatFiles(),
  ]);
};
