import { chain, SchematicContext, Tree } from '@angular-devkit/schematics';
import { formatFiles } from '../../utils/rules/format-files';
import { updateWorkspaceInTree } from '../../utils/ast-utils';

function removeEslintConfigOption(host: Tree, context: SchematicContext) {
  return updateWorkspaceInTree((json) => {
    Object.values<any>(json.projects).forEach((project) => {
      if (!project.architect) {
        return;
      }
      Object.values<any>(project.architect).forEach((target) => {
        if (target.builder !== '@nrwl/linter:lint') {
          return;
        }
        if (target?.options?.config === `${project.root}/.eslintrc`) {
          delete target.options.config;
        }
        if (!target.configurations) {
          return;
        }
        Object.values<any>(target.configurations).forEach((options) => {
          if (options.config === `${project.root}/.eslintrc`) {
            delete options.config;
          }
        });
      });
    });
    return json;
  });
}

export default function () {
  return chain([removeEslintConfigOption, formatFiles()]);
}
