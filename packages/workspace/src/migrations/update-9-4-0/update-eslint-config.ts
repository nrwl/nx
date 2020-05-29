import { chain, SchematicContext, Tree } from '@angular-devkit/schematics';
import { formatFiles, updateWorkspaceInTree } from '@nrwl/workspace';

function removeEslintConfigOption(host: Tree, context: SchematicContext) {
  return updateWorkspaceInTree((json) => {
    Object.keys(json.projects).forEach((name) => {
      const p = json.projects[name];
      if (
        p.architect?.lint.builder === '@nrwl/linter:lint' &&
        p.architect?.lint.options?.config === `${p.root}/.eslintrc`
      ) {
        delete p.architect.lint.options.config;
      }
    });
    return json;
  });
}

export default function () {
  return chain([removeEslintConfigOption, formatFiles()]);
}
