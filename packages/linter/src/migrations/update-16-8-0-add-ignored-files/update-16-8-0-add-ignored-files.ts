import { getProjects, Tree } from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import {
  findEslintFile,
  isEslintConfigSupported,
  lintConfigHasOverride,
  updateOverrideInLintConfig,
} from '../../generators/utils/eslint-file';

// Add `ignoredFiles` pattern to projects using vite, esbuild, and rollup.
// This is needed because the @nx/dependency-checks lint rule will complain
// about dependencies used in build config files, even though they are not
// production dependencies.
export default function update(tree: Tree) {
  const projects = getProjects(tree);

  const addIgnorePattern =
    (ignorePattern: string) => (_options: unknown, projectName: string) => {
      const project = projects.get(projectName);
      if (
        !findEslintFile(tree, project.root) ||
        !isEslintConfigSupported(tree)
      ) {
        return;
      }
      if (
        lintConfigHasOverride(
          tree,
          project.root,
          (o) =>
            Array.isArray(o.files)
              ? o.files.some((f) => f.match(/\.json$/))
              : !!o.files?.match(/\.json$/),
          true
        )
      ) {
        updateOverrideInLintConfig(
          tree,
          project.root,
          (o) => !!o.rules?.['@nx/dependency-checks'],
          (o) => {
            const value = o.rules['@nx/dependency-checks'];
            let ruleSeverity: 0 | 1 | 2 | 'error' | 'warn' | 'off';
            let ruleOptions: any;
            if (Array.isArray(value)) {
              ruleSeverity = value[0];
              ruleOptions = value[1];
            } else {
              ruleSeverity = value;
              ruleOptions = {};
            }
            ruleOptions.ignoredFiles = [ignorePattern];
            o.rules['@nx/dependency-checks'] = [ruleSeverity, ruleOptions];
            return o;
          }
        );
      }
    };

  forEachExecutorOptions(
    tree,
    '@nx/vite:build',
    addIgnorePattern('{projectRoot}/vite.config.{js,ts,mjs,mts}')
  );
  forEachExecutorOptions(
    tree,
    '@nx/vite:test',
    addIgnorePattern('{projectRoot}/vite.config.{js,ts,mjs,mts}')
  );
  forEachExecutorOptions(
    tree,
    '@nx/esbuild:esbuild',
    addIgnorePattern('{projectRoot}/esbuild.config.{js,ts,mjs,mts}')
  );
  forEachExecutorOptions(
    tree,
    '@nx/rollup:rollup',
    addIgnorePattern('{projectRoot}/rollup.config.{js,ts,mjs,mts}')
  );
}
