import { normalize } from '@angular-devkit/core';
import { chain, Rule, Tree } from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  formatFiles,
  getNpmScope,
  readJsonInTree,
  readWorkspace,
  updateJsonInTree,
  updateWorkspaceInTree,
} from '@nrwl/workspace';
import { join } from 'path';
import { offsetFromRoot } from '@nrwl/devkit';
import { createProjectGraphAsync } from '@nrwl/workspace/src/core/project-graph';

/**
 * It was decided with Jason that we would do a simple replacement in this migration
 * because Angular + ESLint support has been experimental until this point.
 */
function updateESLintConfigForProject(
  projectRoot: string,
  prefix: string
): Rule {
  return updateJsonInTree(join(normalize(projectRoot), '.eslintrc.json'), () =>
    createAngularEslintJson(projectRoot, prefix)
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

async function updateProjectESLintConfigsAndBuilders(
  host: Tree
): Promise<Rule> {
  const graph = await createProjectGraphAsync();

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

    if (
      !graph.dependencies[projectName].some(
        (dependency) =>
          dependency.target.startsWith('npm:@angular/') &&
          graph.externalNodes[dependency.target]
      )
    ) {
      return;
    }
    Object.keys(project.architect || {}).forEach((targetName) => {
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
              '@angular-eslint/eslint-plugin': '~1.0.0',
              '@angular-eslint/eslint-plugin-template': '~1.0.0',
              '@angular-eslint/template-parser': '~1.0.0',
            },
            false
          )
        );
        addedExtraDevDeps = true;
      }

      // Using the npm scope as the fallback replicates the generation behavior
      const projectPrefx = project.prefix || getNpmScope(host);

      rules.push(updateESLintConfigForProject(project.root, projectPrefx));

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
function createAngularEslintJson(projectRoot: string, prefix: string) {
  return {
    extends: `${offsetFromRoot(projectRoot)}.eslintrc.json`,
    ignorePatterns: ['!**/*'],
    overrides: [
      {
        files: ['*.ts'],
        extends: [
          'plugin:@nrwl/nx/angular',
          'plugin:@angular-eslint/template/process-inline-templates',
        ],
        parserOptions: {
          project: [`${projectRoot}/tsconfig.*?.json`],
        },
        rules: {
          '@angular-eslint/directive-selector': [
            'error',
            { type: 'attribute', prefix, style: 'camelCase' },
          ],
          '@angular-eslint/component-selector': [
            'error',
            { type: 'element', prefix, style: 'kebab-case' },
          ],
        },
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
    ],
  };
}
