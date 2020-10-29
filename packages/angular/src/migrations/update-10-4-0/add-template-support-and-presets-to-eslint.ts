import { normalize } from '@angular-devkit/core';
import { chain, Rule, Tree } from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  formatFiles,
  offsetFromRoot,
  readJsonInTree,
  readWorkspace,
  updateJsonInTree,
  updateWorkspaceInTree,
} from '@nrwl/workspace';
import { join } from 'path';

/**
 * It was decided with Jason that we would do a simple replacement in this migration
 * because Angular + ESLint support has been experimental until this point.
 */
function updateESLintConfigForProject(projectRoot: string): Rule {
  return updateJsonInTree(join(normalize(projectRoot), '.eslintrc.json'), () =>
    createAngularEslintJson(projectRoot)
  );
}

function addHTMLPatternToBuilderConfig(
  projectName: string,
  projectSourceRoot: string,
  targetName: string
): Rule {
  return updateWorkspaceInTree((workspaceJson) => {
    workspaceJson.projects[projectName].architect[
      targetName
    ].options.lintFilePatterns.push(`${projectSourceRoot}/**/*.html`);
    return workspaceJson;
  });
}

function updateProjectESLintConfigsAndBuilders(host: Tree): Rule {
  /**
   * Make sure user is already using ESLint and is up to date with
   * previous migrations
   */
  if (!host.exists('.eslintrc.json')) {
    return;
  }
  if (!readJsonInTree(host, '.eslintrc.json').overrides?.length) {
    return;
  }

  const workspace = readWorkspace(host);
  const rules = [];

  let addedExtraDevDeps = false;

  Object.keys(workspace.projects).forEach((projectName) => {
    const project = workspace.projects[projectName];

    Object.keys(project.architect).forEach((targetName) => {
      const target = project.architect[targetName];
      if (target.builder !== '@nrwl/linter:eslint') {
        return;
      }

      /**
       * To reach this point we must have found that at least one project is configured
       * to use ESLint, therefore we should install the extra devDependencies to ensure
       * that the updated ESLint config will work correctly
       */
      if (!addedExtraDevDeps) {
        rules.push(
          addDepsToPackageJson(
            {},
            {
              '@angular-eslint/eslint-plugin': '0.6.0-beta.0',
              '@angular-eslint/eslint-plugin-template': '0.6.0-beta.0',
              '@angular-eslint/template-parser': '0.6.0-beta.0',
            },
            false
          )
        );
        addedExtraDevDeps = true;
      }

      rules.push(updateESLintConfigForProject(project.root));

      rules.push(
        addHTMLPatternToBuilderConfig(
          projectName,
          project.sourceRoot,
          targetName
        )
      );
    });
  });

  return chain(rules);
}

export default function () {
  return chain([updateProjectESLintConfigsAndBuilders, formatFiles()]);
}

/**
 * This is effectively a duplicate of the current (at the time of writing this migration) combined
 * logic (across workspace utils/lint.ts and angular utils/lint.ts) for an Angular Project's ESLint config.
 */
function createAngularEslintJson(projectRoot: string) {
  return {
    extends: `${offsetFromRoot(projectRoot)}.eslintrc.json`,
    ignorePatterns: ['!**/*'],
    overrides: [
      {
        files: ['*.ts'],
        extends: ['plugin:@nrwl/nx/angular-code'],
        parserOptions: {
          project: [`${projectRoot}/tsconfig.*?.json`],
        },
        /**
         * Having an empty rules object present makes it more obvious to the user where they would
         * extend things from if they needed to
         */
        rules: {},
      },
      {
        files: ['*.html'],
        extends: ['plugin:@nrwl/nx/angular-template'],
        /**
         * Having an empty rules object present makes it more obvious to the user where they would
         * extend things from if they needed to
         */
        rules: {},
      },
      {
        files: ['*.component.ts'],
        extends: ['plugin:@angular-eslint/template/process-inline-templates'],
        settings: {
          NX_DOCUMENTATION_NOTE:
            'This entry in the overrides is only here to extract inline templates from Components, you should not configure rules here',
        },
      },
    ],
  };
}
