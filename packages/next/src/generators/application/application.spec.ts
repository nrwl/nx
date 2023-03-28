import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import {
  getProjects,
  NxJsonConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';

import { applicationGenerator } from './application';

describe('app', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  describe('not nested', () => {
    it('should update configurations', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'css',
      });

      expect(readProjectConfiguration(tree, 'my-app').root).toEqual(
        'apps/my-app'
      );
      expect(readProjectConfiguration(tree, 'my-app-e2e').root).toEqual(
        'apps/my-app-e2e'
      );
    });

    it('should update tags and implicit dependencies', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'css',
        tags: 'one,two',
      });

      const projects = Object.fromEntries(getProjects(tree));

      expect(projects).toMatchObject({
        'my-app': {
          tags: ['one', 'two'],
        },
        'my-app-e2e': {
          tags: [],
          implicitDependencies: ['my-app'],
        },
      });
    });

    it('should generate files', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'css',
      });
      expect(tree.exists('apps/my-app/tsconfig.json')).toBeTruthy();
      expect(tree.exists('apps/my-app/pages/index.tsx')).toBeTruthy();
      expect(tree.exists('apps/my-app/specs/index.spec.tsx')).toBeTruthy();
      expect(tree.exists('apps/my-app/pages/index.module.css')).toBeTruthy();
    });

    it('should extend from root tsconfig.base.json', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'css',
      });

      const tsConfig = readJson(tree, 'apps/my-app/tsconfig.json');
      expect(tsConfig.extends).toBe('../../tsconfig.base.json');
    });

    it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
      tree.rename('tsconfig.base.json', 'tsconfig.json');

      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'css',
      });

      const tsConfig = readJson(tree, 'apps/my-app/tsconfig.json');
      expect(tsConfig.extends).toBe('../../tsconfig.json');
    });
  });

  describe('--style scss', () => {
    it('should generate scss styles', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'scss',
      });

      expect(tree.exists('apps/my-app/pages/index.module.scss')).toBeTruthy();
      expect(tree.exists('apps/my-app/pages/styles.css')).toBeTruthy();

      const indexContent = tree.read('apps/my-app/pages/index.tsx', 'utf-8');
      expect(indexContent).toContain(
        `import styles from './index.module.scss'`
      );
    });
  });

  describe('--style less', () => {
    it('should generate scss styles', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'less',
      });

      expect(tree.exists('apps/my-app/pages/index.module.less')).toBeTruthy();
      expect(tree.exists('apps/my-app/pages/styles.less')).toBeTruthy();

      const indexContent = tree.read('apps/my-app/pages/index.tsx', 'utf-8');
      expect(indexContent).toContain(
        `import styles from './index.module.less'`
      );
    });
  });

  describe('--style styl', () => {
    it('should generate scss styles', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'styl',
      });

      expect(tree.exists('apps/my-app/pages/index.module.styl')).toBeTruthy();
      expect(tree.exists('apps/my-app/pages/styles.styl')).toBeTruthy();

      const indexContent = tree.read('apps/my-app/pages/index.tsx', 'utf-8');
      expect(indexContent).toContain(
        `import styles from './index.module.styl'`
      );
    });
  });

  describe('--style styled-components', () => {
    it('should generate scss styles', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'styled-components',
      });

      expect(
        tree.exists('apps/my-app/pages/index.module.styled-components')
      ).toBeFalsy();
      expect(tree.exists('apps/my-app/pages/styles.css')).toBeTruthy();

      const indexContent = tree.read('apps/my-app/pages/index.tsx', 'utf-8');
      expect(indexContent).not.toContain(`import styles from './index.module`);
      expect(indexContent).toContain(`import styled from 'styled-components'`);
    });
  });

  describe('--style @emotion/styled', () => {
    it('should generate scss styles', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: '@emotion/styled',
      });

      expect(
        tree.exists('apps/my-app/pages/index.module.styled-components')
      ).toBeFalsy();
      expect(tree.exists('apps/my-app/pages/styles.css')).toBeTruthy();

      const indexContent = tree.read('apps/my-app/pages/index.tsx', 'utf-8');
      expect(indexContent).not.toContain(`import styles from './index.module`);
      expect(indexContent).toContain(`import styled from '@emotion/styled'`);
    });

    it('should add jsxImportSource in tsconfig.json', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: '@emotion/styled',
      });

      const tsconfigJson = readJson(tree, 'apps/my-app/tsconfig.json');

      expect(tsconfigJson.compilerOptions['jsxImportSource']).toEqual(
        '@emotion/react'
      );
    });
  });

  describe('--style styled-jsx', () => {
    it('should use <style jsx> in index page', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'styled-jsx',
      });

      const indexContent = tree.read('apps/my-app/pages/index.tsx', 'utf-8');

      expect(indexContent).toMatchSnapshot();
      expect(
        tree.exists('apps/my-app/pages/index.module.styled-jsx')
      ).toBeFalsy();
      expect(tree.exists('apps/my-app/pages/styles.css')).toBeTruthy();

      expect(indexContent).not.toContain(`import styles from './index.module`);
      expect(indexContent).not.toContain(
        `import styled from 'styled-components'`
      );
    });
  });

  it('should setup jest with tsx support', async () => {
    await applicationGenerator(tree, {
      name: 'my-app',
      style: 'css',
    });

    expect(tree.read('apps/my-app/jest.config.ts', 'utf-8')).toContain(
      `moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],`
    );
  });

  it('should setup jest with SVGR support', async () => {
    await applicationGenerator(tree, {
      name: 'my-app',
      style: 'css',
    });

    expect(tree.read('apps/my-app/jest.config.ts', 'utf-8')).toContain(
      `'^(?!.*\\\\.(js|jsx|ts|tsx|css|json)$)': '@nrwl/react/plugins/jest'`
    );
  });

  it('should set up the nrwl next build builder', async () => {
    await applicationGenerator(tree, {
      name: 'my-app',
      style: 'css',
    });

    const projectConfiguration = readProjectConfiguration(tree, 'my-app');
    expect(projectConfiguration.targets.build.executor).toEqual(
      '@nrwl/next:build'
    );
    expect(projectConfiguration.targets.build.options).toEqual({
      root: 'apps/my-app',
      outputPath: 'dist/apps/my-app',
    });
  });

  it('should set up the nrwl next server builder', async () => {
    await applicationGenerator(tree, {
      name: 'my-app',
      style: 'css',
    });

    const projectConfiguration = readProjectConfiguration(tree, 'my-app');
    expect(projectConfiguration.targets.serve.executor).toEqual(
      '@nrwl/next:server'
    );
    expect(projectConfiguration.targets.serve.options).toEqual({
      buildTarget: 'my-app:build',
      dev: true,
    });
    expect(projectConfiguration.targets.serve.configurations).toEqual({
      development: {
        buildTarget: 'my-app:build:development',
        dev: true,
      },
      production: { dev: false, buildTarget: 'my-app:build:production' },
    });
  });

  it('should set up the nrwl next export builder', async () => {
    await applicationGenerator(tree, {
      name: 'my-app',
      style: 'css',
    });

    const projectConfiguration = readProjectConfiguration(tree, 'my-app');
    expect(projectConfiguration.targets.export.executor).toEqual(
      '@nrwl/next:export'
    );
    expect(projectConfiguration.targets.export.options).toEqual({
      buildTarget: 'my-app:build:production',
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'css',
        unitTestRunner: 'none',
      });
      expect(tree.exists('jest.config.ts')).toBeFalsy();
      expect(tree.exists('apps/my-app/specs/index.spec.tsx')).toBeFalsy();
    });
  });

  describe('--e2e-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'css',
        e2eTestRunner: 'none',
      });
      expect(tree.exists('apps/my-app-e2e')).toBeFalsy();
    });
  });

  it('should generate functional components by default', async () => {
    await applicationGenerator(tree, {
      name: 'myApp',
      style: 'css',
    });

    const appContent = tree.read('apps/my-app/pages/index.tsx', 'utf-8');

    expect(appContent).not.toMatch(/extends Component/);
  });

  describe('--linter', () => {
    describe('default (eslint)', () => {
      it('should add .eslintrc.json and dependencies', async () => {
        await applicationGenerator(tree, {
          name: 'myApp',
          style: 'css',
        });

        const packageJson = readJson(tree, '/package.json');
        expect(packageJson).toMatchObject({
          devDependencies: {
            'eslint-plugin-react': expect.anything(),
            'eslint-plugin-react-hooks': expect.anything(),
          },
        });

        const eslintJson = readJson(tree, '/apps/my-app/.eslintrc.json');
        expect(eslintJson).toMatchInlineSnapshot(`
          Object {
            "env": Object {
              "jest": true,
            },
            "extends": Array [
              "plugin:@nrwl/nx/react-typescript",
              "next",
              "next/core-web-vitals",
              "../../.eslintrc.json",
            ],
            "ignorePatterns": Array [
              "!**/*",
              ".next/**/*",
            ],
            "overrides": Array [
              Object {
                "files": Array [
                  "*.ts",
                  "*.tsx",
                  "*.js",
                  "*.jsx",
                ],
                "rules": Object {
                  "@next/next/no-html-link-for-pages": Array [
                    "error",
                    "apps/my-app/pages",
                  ],
                },
              },
              Object {
                "files": Array [
                  "*.ts",
                  "*.tsx",
                ],
                "rules": Object {},
              },
              Object {
                "files": Array [
                  "*.js",
                  "*.jsx",
                ],
                "rules": Object {},
              },
            ],
            "rules": Object {
              "@next/next/no-html-link-for-pages": "off",
            },
          }
        `);
      });
    });
  });

  describe('--js', () => {
    it('generates JS files', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'css',
        js: true,
      });

      expect(tree.exists('apps/my-app/pages/index.js')).toBeTruthy();
      expect(tree.exists('apps/my-app/specs/index.spec.js')).toBeTruthy();
      expect(tree.exists('apps/my-app/index.d.js')).toBeFalsy();
      expect(tree.exists('apps/my-app/index.d.ts')).toBeFalsy();

      const tsConfig = readJson(tree, 'apps/my-app/tsconfig.json');
      expect(tsConfig.compilerOptions.allowJs).toEqual(true);

      const tsConfigApp = readJson(tree, 'apps/my-app/tsconfig.json');
      expect(tsConfigApp.include).toContain('**/*.js');
      expect(tsConfigApp.exclude).not.toContain('**/*.spec.js');
    });
  });

  it('should add a .gitkeep file to the public directory', async () => {
    await applicationGenerator(tree, {
      name: 'myApp',
      style: 'css',
    });

    expect(tree.exists('apps/my-app/public/.gitkeep')).toBe(true);
  });
});
