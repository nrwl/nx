import { addProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import type { Linter } from 'eslint';
import { join } from 'path';
import {
  convertTSLintDisableCommentsForProject,
  deduplicateOverrides,
} from './utils';

describe('deduplicateOverrides()', () => {
  it('should deduplicate overrides with identical values for "files"', () => {
    const initialOverrides: Linter.Config['overrides'] = [
      {
        files: ['*.ts'],
        env: {
          foo: true,
        },
        rules: {
          bar: 'error',
        },
      },
      {
        files: ['*.html'],
        rules: {},
      },
      {
        files: '*.ts',
        plugins: ['wat'],
        parserOptions: {
          qux: false,
        },
        rules: {
          bar: 'warn',
          baz: 'error',
        },
      },
      {
        files: ['*.ts'],
        extends: ['something'],
      },
    ];
    expect(deduplicateOverrides(initialOverrides)).toEqual([
      {
        files: ['*.ts'],
        env: {
          foo: true,
        },
        plugins: ['wat'],
        extends: ['something'],
        parserOptions: {
          qux: false,
        },
        rules: {
          bar: 'warn',
          baz: 'error',
        },
      },
      {
        files: ['*.html'],
        rules: {},
      },
    ]);
  });
});

describe('convertTSLintDisableCommentsForProject', () => {
  let tree: Tree;
  const projectName = 'foo';
  const projectRoot = `apps/${projectName}`;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, projectName, {
      root: projectRoot,
      projectType: 'application',
      targets: {
        lint: {
          executor: '@angular-devkit/build-angular:tslint',
          options: {
            exclude: ['**/node_modules/**', `!${projectRoot}/**/*`],
            tsConfig: [`${projectRoot}/tsconfig.app.json`],
          },
        },
      },
    });
    tree.write(
      join(projectRoot, 'top-level-file.ts'),
      `
      // tslint:disable
      eval('');
    `
    );
    tree.write(
      join(projectRoot, 'single-level-nested/file.ts'),
      `
      // tslint:disable-next-line
      eval('');
    `
    );
    // specific rule, and multi-line-comment style
    tree.write(
      join(projectRoot, 'multi-level/nested/file.ts'),
      `
      /* tslint:disable:quotemark */
      eval('');
    `
    );
  });
  it('should replace tslint:disable comments with their ESLint equivalents in .ts files for the given project', () => {
    convertTSLintDisableCommentsForProject(tree, projectName);

    expect(
      tree.read(join(projectRoot, 'top-level-file.ts')).toString()
    ).toMatchSnapshot();
    expect(
      tree.read(join(projectRoot, 'single-level-nested/file.ts')).toString()
    ).toMatchSnapshot();
    expect(
      tree.read(join(projectRoot, 'multi-level/nested/file.ts')).toString()
    ).toMatchSnapshot();
  });
});
