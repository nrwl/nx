import { NxJsonConfiguration } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { applicationGenerator } from './application';
import { readJson, Tree } from '@nrwl/devkit';

describe('app', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('.gitignore', '# empty');
    tree.write('.prettierignore', '# empty');
  });

  it('should update workspace.json', async () => {
    await applicationGenerator(tree, { name: 'myApp', style: 'css' });
    const workspaceJson = readJson(tree, '/workspace.json');

    expect(workspaceJson.projects['my-app'].root).toEqual('apps/my-app');
    expect(workspaceJson.projects['my-app-e2e'].root).toEqual(
      'apps/my-app-e2e'
    );
    expect(workspaceJson.defaultProject).toEqual('my-app');
  });

  it('should update nx.json', async () => {
    await applicationGenerator(tree, {
      name: 'myApp',
      style: 'css',
      tags: 'one,two',
    });
    const nxJson = readJson<NxJsonConfiguration>(tree, '/nx.json');
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
    await applicationGenerator(tree, { name: 'myApp', style: 'css' });
    expect(tree.exists('apps/my-app/tsconfig.json')).toBeTruthy();
    expect(tree.exists('apps/my-app/tsconfig.app.json')).toBeTruthy();
    expect(tree.exists('apps/my-app/src/pages/index.tsx')).toBeTruthy();
    expect(tree.exists('apps/my-app/src/pages/index.spec.tsx')).toBeTruthy();
    expect(tree.exists('apps/my-app/src/pages/index.module.css')).toBeTruthy();
  });

  describe('--style scss', () => {
    it('should generate scss styles', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'scss',
      });
      expect(
        tree.exists('apps/my-app/src/pages/index.module.scss')
      ).toBeTruthy();

      const indexContent = tree
        .read('apps/my-app/src/pages/index.tsx')
        .toString();
      expect(indexContent).toContain(
        `import styles from './index.module.scss'`
      );

      const workspaceJson = readJson(tree, '/workspace.json');
      expect(
        workspaceJson.schematics['@nrwl/gatsby'].application.style
      ).toEqual('scss');
    });
  });

  describe('--style less', () => {
    it('should generate less styles', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'less',
      });
      expect(
        tree.exists('apps/my-app/src/pages/index.module.less')
      ).toBeTruthy();

      const indexContent = tree
        .read('apps/my-app/src/pages/index.tsx')
        .toString();
      expect(indexContent).toContain(
        `import styles from './index.module.less'`
      );

      const workspaceJson = readJson(tree, '/workspace.json');
      expect(
        workspaceJson.schematics['@nrwl/gatsby'].application.style
      ).toEqual('less');
    });
  });

  describe('--style styl', () => {
    it('should generate stylus styles', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'styl',
      });
      expect(
        tree.exists('apps/my-app/src/pages/index.module.styl')
      ).toBeTruthy();

      const indexContent = tree
        .read('apps/my-app/src/pages/index.tsx')
        .toString();
      expect(indexContent).toContain(
        `import styles from './index.module.styl'`
      );

      const workspaceJson = readJson(tree, '/workspace.json');
      expect(
        workspaceJson.schematics['@nrwl/gatsby'].application.style
      ).toEqual('styl');
    });
  });

  describe('--style styled-components', () => {
    it('should generate scss styles', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'styled-components',
      });
      expect(
        tree.exists('apps/my-app/src/pages/index.module.styled-components')
      ).toBeFalsy();

      const indexContent = tree
        .read('apps/my-app/src/pages/index.tsx')
        .toString();
      expect(indexContent).not.toContain(`import styles from './index.module`);
      expect(indexContent).toContain(`import styled from 'styled-components'`);

      const workspaceJson = readJson(tree, '/workspace.json');
      expect(
        workspaceJson.schematics['@nrwl/gatsby'].application.style
      ).toEqual('styled-components');
    });
  });

  describe('--style @emotion/styled', () => {
    it('should generate emotion styles', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: '@emotion/styled',
      });
      expect(
        tree.exists('apps/my-app/src/pages/index.module.styled-components')
      ).toBeFalsy();

      const indexContent = tree
        .read('apps/my-app/src/pages/index.tsx')
        .toString();
      expect(indexContent).not.toContain(`import styles from './index.module`);
      expect(indexContent).toContain(`import styled from '@emotion/styled'`);

      const workspaceJson = readJson(tree, '/workspace.json');
      expect(
        workspaceJson.schematics['@nrwl/gatsby'].application.style
      ).toEqual('@emotion/styled');
    });
  });

  // TODO: We should also add styled-jsx support for Gatsby to keep React plugins consistent.
  // This needs to be here before Nx 12 is released.
  xdescribe('--style styled-jsx', () => {
    it('should use <style jsx> in index page', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'styled-jsx',
      });

      const indexContent = tree
        .read('apps/my-app/src/pages/index.tsx')
        .toString();

      expect(indexContent).toMatch(/<style jsx>/);
      expect(
        tree.exists('apps/my-app/src/pages/index.module.styled-jsx')
      ).toBeFalsy();

      expect(indexContent).not.toContain(`import styles from './index.module`);
      expect(indexContent).not.toContain(
        `import styled from 'styled-components'`
      );

      const workspaceJson = readJson(tree, '/workspace.json');
      expect(
        workspaceJson.schematics['@nrwl/gatsby'].application.style
      ).toEqual('styled-jsx');
    });
  });

  it('should setup jest with tsx support', async () => {
    await applicationGenerator(tree, {
      name: 'my-app',
      style: 'css',
    });

    expect(tree.read('apps/my-app/jest.config.js').toString('utf-8')).toContain(
      `moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],`
    );
  });

  it('should setup jest with SVGR support', async () => {
    await applicationGenerator(tree, {
      name: 'my-app',
      style: 'css',
    });

    expect(tree.read('apps/my-app/jest.config.js').toString('utf-8')).toContain(
      `'^(?!.*\\\\.(js|jsx|ts|tsx|css|json)$)': '@nrwl/react/plugins/jest'`
    );
  });

  it('should set up the nrwl gatsby build builder', async () => {
    await applicationGenerator(tree, {
      name: 'my-app',
      style: 'css',
    });
    const workspaceJson = readJson(tree, 'workspace.json');
    const architectConfig = workspaceJson.projects['my-app'].architect;
    expect(architectConfig.build.builder).toEqual('@nrwl/gatsby:build');
    expect(architectConfig.build.options).toMatchObject({
      outputPath: 'apps/my-app/public',
    });
  });

  it('should set up the nrwl gatsby server builder', async () => {
    await applicationGenerator(tree, {
      name: 'my-app',
      style: 'css',
    });
    const workspaceJson = readJson(tree, 'workspace.json');
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
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'css',
        unitTestRunner: 'none',
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
      });
      expect(tree.exists('apps/my-app-e2e')).toBeFalsy();
      const workspaceJson = readJson(tree, 'workspace.json');
      expect(workspaceJson.projects['my-app-e2e']).toBeUndefined();
    });
  });

  it('should generate an index component', async () => {
    await applicationGenerator(tree, { name: 'myApp', style: 'css' });

    const appContent = tree.read('apps/my-app/src/pages/index.tsx').toString();

    expect(appContent).not.toMatch(/extends Component/);
  });

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
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'css',
        js: true,
      });

      expect(tree.exists('apps/my-app/src/pages/index.js')).toBeTruthy();
      expect(tree.exists('apps/my-app/src/pages/index.spec.js')).toBeTruthy();

      const tsConfig = readJson(tree, 'apps/my-app/tsconfig.json');
      expect(tsConfig.compilerOptions.allowJs).toEqual(true);

      const tsConfigApp = readJson(tree, 'apps/my-app/tsconfig.app.json');
      expect(tsConfigApp.include).toContain('**/*.js');
      expect(tsConfigApp.exclude).toContain('**/*.spec.js');
    });
  });
});
