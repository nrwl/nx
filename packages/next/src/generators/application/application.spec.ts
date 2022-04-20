import { Linter } from '@nrwl/linter';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { getProjects, readJson, NxJsonConfiguration, Tree } from '@nrwl/devkit';

import { applicationGenerator } from './application';

describe('app', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('not nested', () => {
    it('should update workspace.json and set defaultProject', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'css',
        standaloneConfig: false,
      });

      const workspaceJson = readJson(tree, 'workspace.json');
      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');

      expect(workspaceJson.projects['my-app'].root).toEqual('apps/my-app');
      expect(workspaceJson.projects['my-app-e2e'].root).toEqual(
        'apps/my-app-e2e'
      );
      expect(nxJson.defaultProject).toEqual('my-app');
    });

    it('should update tags and implicit dependencies', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'css',
        tags: 'one,two',
        standaloneConfig: false,
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
        standaloneConfig: false,
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
        standaloneConfig: false,
      });

      const tsConfig = readJson(tree, 'apps/my-app/tsconfig.json');
      expect(tsConfig.extends).toBe('../../tsconfig.base.json');
    });

    it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
      tree.rename('tsconfig.base.json', 'tsconfig.json');

      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'css',
        standaloneConfig: false,
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
        standaloneConfig: false,
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
        standaloneConfig: false,
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
        standaloneConfig: false,
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
        standaloneConfig: false,
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
        standaloneConfig: false,
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
        standaloneConfig: false,
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
        standaloneConfig: false,
      });

      const indexContent = tree.read('apps/my-app/pages/index.tsx', 'utf-8');

      expect(indexContent).toMatch(/<style jsx>{`.page {}`}<\/style>/);
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
      standaloneConfig: false,
    });

    expect(tree.read('apps/my-app/jest.config.js', 'utf-8')).toContain(
      `moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],`
    );
  });

  it('should setup jest with SVGR support', async () => {
    await applicationGenerator(tree, {
      name: 'my-app',
      style: 'css',
      standaloneConfig: false,
    });

    expect(tree.read('apps/my-app/jest.config.js', 'utf-8')).toContain(
      `'^(?!.*\\\\.(js|jsx|ts|tsx|css|json)$)': '@nrwl/react/plugins/jest'`
    );
  });

  it('should set up the nrwl next build builder', async () => {
    await applicationGenerator(tree, {
      name: 'my-app',
      style: 'css',
      standaloneConfig: false,
    });

    const workspaceJson = readJson(tree, 'workspace.json');
    const architectConfig = workspaceJson.projects['my-app'].architect;
    expect(architectConfig.build.builder).toEqual('@nrwl/next:build');
    expect(architectConfig.build.options).toEqual({
      root: 'apps/my-app',
      outputPath: 'dist/apps/my-app',
    });
  });

  it('should set up the nrwl next server builder', async () => {
    await applicationGenerator(tree, {
      name: 'my-app',
      style: 'css',
      standaloneConfig: false,
    });

    const workspaceJson = readJson(tree, 'workspace.json');
    const architectConfig = workspaceJson.projects['my-app'].architect;
    expect(architectConfig.serve.builder).toEqual('@nrwl/next:server');
    expect(architectConfig.serve.options).toEqual({
      buildTarget: 'my-app:build',
      dev: true,
    });
    expect(architectConfig.serve.configurations).toEqual({
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
      standaloneConfig: false,
    });

    const workspaceJson = readJson(tree, 'workspace.json');
    const architectConfig = workspaceJson.projects['my-app'].architect;
    expect(architectConfig.export.builder).toEqual('@nrwl/next:export');
    expect(architectConfig.export.options).toEqual({
      buildTarget: 'my-app:build:production',
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'css',
        unitTestRunner: 'none',
        standaloneConfig: false,
      });
      expect(tree.exists('jest.config.js')).toBeFalsy();
      expect(tree.exists('apps/my-app/specs/index.spec.tsx')).toBeFalsy();
    });
  });

  describe('--e2e-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'css',
        e2eTestRunner: 'none',
        standaloneConfig: false,
      });
      expect(tree.exists('apps/my-app-e2e')).toBeFalsy();
      const workspaceJson = readJson(tree, 'workspace.json');
      expect(workspaceJson.projects['my-app-e2e']).toBeUndefined();
    });
  });

  it('should generate functional components by default', async () => {
    await applicationGenerator(tree, {
      name: 'myApp',
      style: 'css',
      standaloneConfig: false,
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
          standaloneConfig: false,
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
    "../../.eslintrc.json",
    "next",
    "next/core-web-vitals",
  ],
  "ignorePatterns": Array [
    "!**/*",
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
}
`);
      });
    });

    describe('tslint', () => {
      it('should generate files', async () => {
        await applicationGenerator(tree, {
          name: 'myApp',
          style: 'css',
          linter: Linter.TsLint,
          standaloneConfig: false,
        });

        const tslintJson = readJson(tree, 'apps/my-app/tslint.json');
        expect(tslintJson).toMatchInlineSnapshot(`
          Object {
            "extends": "../../tslint.json",
            "linterOptions": Object {
              "exclude": Array [
                "!**/*",
              ],
            },
            "rules": Object {},
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
        standaloneConfig: false,
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
      standaloneConfig: false,
    });

    expect(tree.exists('apps/my-app/public/.gitkeep')).toBe(true);
  });
});
