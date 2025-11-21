import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { addProjectConfiguration } from '../../generators/utils/project-configuration';
import escapeDollarSignEnvVariables from './escape-dollar-sign-env-variables';

describe('escape $ in env variables', () => {
  let tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should escape $ in env variables in .env file', () => {
    tree.write(
      '.env',
      `dollar=$
NX_SOME_VAR=$ABC`
    );
    escapeDollarSignEnvVariables(tree);
    expect(tree.read('.env', 'utf-8')).toEqual(`dollar=\\$
NX_SOME_VAR=\\$ABC`);
  });

  it('should escape $ env variables in .env file under project', () => {
    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
    });
    addProjectConfiguration(tree, 'my-app2', {
      root: 'apps/my-app2',
    });
    tree.write(
      'apps/my-app/.env',
      `dollar=$
NX_SOME_VAR=$ABC`
    );
    tree.write(
      'apps/my-app2/.env',
      `dollar=$
NX_SOME_VAR=$DEF`
    );
    escapeDollarSignEnvVariables(tree);
    expect(tree.read('apps/my-app/.env', 'utf-8')).toEqual(`dollar=\\$
NX_SOME_VAR=\\$ABC`);
    expect(tree.read('apps/my-app2/.env', 'utf-8')).toEqual(`dollar=\\$
NX_SOME_VAR=\\$DEF`);
  });

  it('should escape $ env variables in .env for target', () => {
    tree.write('.env', 'dollar=$');
    tree.write('.env.build', 'dollar=$');
    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      targets: {
        build: {
          executor: '@nx/node:build',
          configurations: {
            production: {},
          },
        },
      },
    });
    tree.write(
      'apps/my-app/.build.env',
      `dollar=$
NX_SOME_VAR=$ABC`
    );
    tree.write(
      'apps/my-app/.env',
      `dollar=$
NX_SOME_VAR=$ABC`
    );
    escapeDollarSignEnvVariables(tree);
    expect(tree.read('.env', 'utf-8')).toEqual(`dollar=\\$`);
    expect(tree.read('apps/my-app/.env', 'utf-8')).toEqual(`dollar=\\$
NX_SOME_VAR=\\$ABC`);
    expect(tree.read('apps/my-app/.build.env', 'utf-8')).toEqual(`dollar=\\$
NX_SOME_VAR=\\$ABC`);
  });

  it('should escape $ env variables in .env for configuration', () => {
    tree.write('.env', 'dollar=$');
    tree.write('.env.production', 'dollar=$');
    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      targets: {
        build: {
          executor: '@nx/node:build',
          configurations: {
            production: {},
          },
        },
      },
    });
    tree.write(
      'apps/my-app/.production.env',
      `dollar=$
NX_SOME_VAR=$ABC`
    );
    tree.write(
      'apps/my-app/.build.production.env',
      `dollar=$
NX_SOME_VAR=$ABC`
    );
    tree.write(
      'apps/my-app/.env',
      `dollar=$
NX_SOME_VAR=$ABC`
    );
    escapeDollarSignEnvVariables(tree);
    expect(tree.read('.env', 'utf-8')).toEqual(`dollar=\\$`);
    expect(tree.read('apps/my-app/.env', 'utf-8')).toEqual(`dollar=\\$
NX_SOME_VAR=\\$ABC`);
    expect(tree.read('apps/my-app/.build.production.env', 'utf-8'))
      .toEqual(`dollar=\\$
NX_SOME_VAR=\\$ABC`);
    expect(tree.read('apps/my-app/.production.env', 'utf-8'))
      .toEqual(`dollar=\\$
NX_SOME_VAR=\\$ABC`);
  });

  it('should not escape $ env variables if it is already escaped', () => {
    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
    });
    tree.write(
      'apps/my-app/.env',
      `dollar=\\$
NX_SOME_VAR=\\$ABC`
    );
    escapeDollarSignEnvVariables(tree);
    expect(tree.read('apps/my-app/.env', 'utf-8')).toEqual(`dollar=\\$
NX_SOME_VAR=\\$ABC`);
  });
});
