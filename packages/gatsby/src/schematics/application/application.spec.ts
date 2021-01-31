import { Tree } from '@angular-devkit/schematics';
import { NxJson, readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';

describe('app', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
  });

  it('should update workspace.json', async () => {
    const tree = await runSchematic('app', { name: 'myApp' }, appTree);
    const workspaceJson = readJsonInTree(tree, '/workspace.json');

    expect(workspaceJson.projects['my-app'].root).toEqual('apps/my-app');
    expect(workspaceJson.projects['my-app-e2e'].root).toEqual(
      'apps/my-app-e2e'
    );
    expect(workspaceJson.defaultProject).toEqual('my-app');
  });

  it('should update nx.json', async () => {
    const tree = await runSchematic(
      'app',
      { name: 'myApp', tags: 'one,two' },
      appTree
    );
    const nxJson = readJsonInTree<NxJson>(tree, '/nx.json');
    expect(nxJson.projects).toEqual({
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
    const tree = await runSchematic('app', { name: 'myApp' }, appTree);
    expect(tree.exists('apps/my-app/tsconfig.json')).toBeTruthy();
    expect(tree.exists('apps/my-app/tsconfig.app.json')).toBeTruthy();
    expect(tree.exists('apps/my-app/src/pages/index.tsx')).toBeTruthy();
    expect(tree.exists('apps/my-app/src/pages/index.spec.tsx')).toBeTruthy();
    expect(tree.exists('apps/my-app/src/pages/index.module.css')).toBeTruthy();
  });

  describe('--style scss', () => {
    it('should generate scss styles', async () => {
      const result = await runSchematic(
        'app',
        { name: 'myApp', style: 'scss' },
        appTree
      );
      expect(
        result.exists('apps/my-app/src/pages/index.module.scss')
      ).toBeTruthy();

      const indexContent = result
        .read('apps/my-app/src/pages/index.tsx')
        .toString();
      expect(indexContent).toContain(
        `import styles from './index.module.scss'`
      );
    });
  });

  describe('--style less', () => {
    it('should generate less styles', async () => {
      const result = await runSchematic(
        'app',
        { name: 'myApp', style: 'less' },
        appTree
      );
      expect(
        result.exists('apps/my-app/src/pages/index.module.less')
      ).toBeTruthy();

      const indexContent = result
        .read('apps/my-app/src/pages/index.tsx')
        .toString();
      expect(indexContent).toContain(
        `import styles from './index.module.less'`
      );
    });
  });

  describe('--style styl', () => {
    it('should generate stylus styles', async () => {
      const result = await runSchematic(
        'app',
        { name: 'myApp', style: 'styl' },
        appTree
      );
      expect(
        result.exists('apps/my-app/src/pages/index.module.styl')
      ).toBeTruthy();

      const indexContent = result
        .read('apps/my-app/src/pages/index.tsx')
        .toString();
      expect(indexContent).toContain(
        `import styles from './index.module.styl'`
      );
    });
  });

  describe('--style styled-components', () => {
    it('should generate scss styles', async () => {
      const result = await runSchematic(
        'app',
        { name: 'myApp', style: 'styled-components' },
        appTree
      );
      expect(
        result.exists('apps/my-app/src/pages/index.module.styled-components')
      ).toBeFalsy();

      const indexContent = result
        .read('apps/my-app/src/pages/index.tsx')
        .toString();
      expect(indexContent).not.toContain(`import styles from './index.module`);
      expect(indexContent).toContain(`import styled from 'styled-components'`);
    });
  });

  describe('--style @emotion/styled', () => {
    it('should generate emotion styles', async () => {
      const result = await runSchematic(
        'app',
        { name: 'myApp', style: '@emotion/styled' },
        appTree
      );
      expect(
        result.exists('apps/my-app/src/pages/index.module.styled-components')
      ).toBeFalsy();

      const indexContent = result
        .read('apps/my-app/src/pages/index.tsx')
        .toString();
      expect(indexContent).not.toContain(`import styles from './index.module`);
      expect(indexContent).toContain(`import styled from '@emotion/styled'`);
    });
  });

  // TODO: We should also add styled-jsx support for Gatsby to keep React plugins consistent.
  // This needs to be here before Nx 12 is released.
  xdescribe('--style styled-jsx', () => {
    it('should use <style jsx> in index page', async () => {
      const result = await runSchematic(
        'app',
        { name: 'myApp', style: 'styled-jsx' },
        appTree
      );

      const indexContent = result
        .read('apps/my-app/src/pages/index.tsx')
        .toString();

      const babelJestConfig = readJsonInTree(
        result,
        'apps/my-app/babel-jest.config.json'
      );

      expect(indexContent).toMatch(/<style jsx>/);
      expect(babelJestConfig.plugins).toContain('styled-jsx/babel');
      expect(
        result.exists('apps/my-app/src/pages/index.module.styled-jsx')
      ).toBeFalsy();

      expect(indexContent).not.toContain(`import styles from './index.module`);
      expect(indexContent).not.toContain(
        `import styled from 'styled-components'`
      );
    });
  });

  it('should setup jest with tsx support', async () => {
    const tree = await runSchematic(
      'app',
      {
        name: 'my-app',
      },
      appTree
    );

    expect(tree.readContent('apps/my-app/jest.config.js')).toContain(
      `moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],`
    );
  });

  it('should setup jest with SVGR support', async () => {
    const tree = await runSchematic(
      'app',
      {
        name: 'my-app',
      },
      appTree
    );

    expect(tree.readContent('apps/my-app/jest.config.js')).toContain(
      `'^(?!.*\\\\.(js|jsx|ts|tsx|css|json)$)': '@nrwl/react/plugins/jest'`
    );
  });

  it('should set up the nrwl gatsby build builder', async () => {
    const tree = await runSchematic(
      'app',
      {
        name: 'my-app',
      },
      appTree
    );
    const workspaceJson = readJsonInTree(tree, 'workspace.json');
    const architectConfig = workspaceJson.projects['my-app'].architect;
    expect(architectConfig.build.builder).toEqual('@nrwl/gatsby:build');
    expect(architectConfig.build.options).toMatchObject({
      outputPath: 'apps/my-app/public',
    });
  });

  it('should set up the nrwl gatsby server builder', async () => {
    const tree = await runSchematic(
      'app',
      {
        name: 'my-app',
      },
      appTree
    );
    const workspaceJson = readJsonInTree(tree, 'workspace.json');
    const architectConfig = workspaceJson.projects['my-app'].architect;
    expect(architectConfig.serve.builder).toEqual('@nrwl/gatsby:server');
    expect(architectConfig.serve.options).toMatchObject({
      buildTarget: 'my-app:build',
    });
    expect(architectConfig.serve.configurations).toEqual({
      production: { buildTarget: 'my-app:build:production' },
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      const tree = await runSchematic(
        'app',
        { name: 'myApp', unitTestRunner: 'none' },
        appTree
      );
      expect(tree.exists('jest.config.js')).toBeFalsy();
      expect(tree.exists('apps/my-app/specs/index.spec.tsx')).toBeFalsy();
    });
  });

  describe('--e2e-test-runner none', () => {
    it('should not generate test configuration', async () => {
      const tree = await runSchematic(
        'app',
        { name: 'myApp', e2eTestRunner: 'none' },
        appTree
      );
      expect(tree.exists('apps/my-app-e2e')).toBeFalsy();
      const workspaceJson = readJsonInTree(tree, 'workspace.json');
      expect(workspaceJson.projects['my-app-e2e']).toBeUndefined();
    });
  });

  it('should generate an index component', async () => {
    const tree = await runSchematic('app', { name: 'myApp' }, appTree);

    const appContent = tree.read('apps/my-app/src/pages/index.tsx').toString();

    expect(appContent).not.toMatch(/extends Component/);
  });

  it('should add .eslintrc.json and dependencies', async () => {
    const tree = await runSchematic(
      'app',
      { name: 'myApp', linter: 'eslint' },
      appTree
    );

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson).toMatchObject({
      devDependencies: {
        'eslint-plugin-react': expect.anything(),
        'eslint-plugin-react-hooks': expect.anything(),
      },
    });

    const eslintJson = readJsonInTree(tree, '/apps/my-app/.eslintrc.json');
    expect(eslintJson).toMatchInlineSnapshot(`
      Object {
        "extends": Array [
          "plugin:@nrwl/nx/react",
          "../../.eslintrc.json",
        ],
        "ignorePatterns": Array [
          "!**/*",
          "public",
          ".cache",
        ],
        "overrides": Array [
          Object {
            "files": Array [
              "*.ts",
              "*.tsx",
              "*.js",
              "*.jsx",
            ],
            "parserOptions": Object {
              "project": Array [
                "apps/my-app/tsconfig.*?.json",
              ],
            },
            "rules": Object {},
          },
          Object {
            "files": Array [
              "*.ts",
              "*.tsx",
            ],
            "rules": Object {
              "@typescript-eslint/camelcase": "off",
            },
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

  describe('--js', () => {
    it('generates JS files', async () => {
      const tree = await runSchematic(
        'app',
        { name: 'myApp', js: true },
        appTree
      );

      expect(tree.exists('apps/my-app/src/pages/index.js')).toBeTruthy();
      expect(tree.exists('apps/my-app/src/pages/index.spec.js')).toBeTruthy();
      expect(tree.exists('apps/my-app/index.d.js')).toBeFalsy();
      expect(tree.exists('apps/my-app/index.d.ts')).toBeFalsy();

      const tsConfig = readJsonInTree(tree, 'apps/my-app/tsconfig.json');
      expect(tsConfig.compilerOptions.allowJs).toEqual(true);

      const tsConfigApp = readJsonInTree(tree, 'apps/my-app/tsconfig.app.json');
      expect(tsConfigApp.include).toContain('**/*.js');
      expect(tsConfigApp.exclude).toContain('**/*.spec.js');
    });
  });
});
