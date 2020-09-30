import { chain, Tree } from '@angular-devkit/schematics';
import { formatFiles, readJsonInTree, updateWorkspace } from '@nrwl/workspace';
import { join, normalize } from '@angular-devkit/core';

/**
 * When migrating projects we need to look up any relevant tsconfig files
 * to figure out what glob patterns will stand the best chance of keeping
 * the file includes behavior as consistent as possible, before and after
 * the migration.
 */
function updateESLintBuilder(host: Tree) {
  return updateWorkspace((workspace) => {
    workspace.projects.forEach((project) => {
      const lintTarget = project.targets.get('lint');
      if (
        lintTarget?.builder !== '@nrwl/linter:lint' ||
        lintTarget?.options?.linter === 'tslint'
      ) {
        return;
      }
      lintTarget.builder = '@nrwl/linter:eslint';

      const tsconfigs = [];

      try {
        tsconfigs.push(readJsonInTree(host, `${project.root}/tsconfig.json`));
      } catch {}
      try {
        tsconfigs.push(
          readJsonInTree(host, `${project.root}/tsconfig.app.json`)
        );
      } catch {}
      try {
        tsconfigs.push(
          readJsonInTree(host, `${project.root}/tsconfig.lib.json`)
        );
      } catch {}
      try {
        tsconfigs.push(
          readJsonInTree(host, `${project.root}/tsconfig.spec.json`)
        );
      } catch {}

      const defaultLintFilePatterns = [`${project.root}/**/*.ts`];

      // Merge any available `includes` and `files` from the tsconfig files
      const lintFilePatterns = !tsconfigs.length
        ? defaultLintFilePatterns
        : tsconfigs
            .map((tsconfig) => {
              return [...(tsconfig.include || []), ...(tsconfig.files || [])];
            })
            .reduce((flat, val) => flat.concat(val), [])
            .map((pattern) => join(normalize(project.root), pattern));

      lintTarget.options = {
        lintFilePatterns,
      };
    });
  });
}

export default function () {
  return chain([updateESLintBuilder, formatFiles()]);
}
