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

  describe('not nested', () => {
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
      expect(tree.exists('apps/my-app/pages/index.tsx')).toBeTruthy();
      expect(tree.exists('apps/my-app/specs/index.spec.tsx')).toBeTruthy();
      expect(tree.exists('apps/my-app/pages/index.module.css')).toBeTruthy();
    });
  });

  describe('--style scss', () => {
    it('should generate scss styles', async () => {
      const result = await runSchematic(
        'app',
        { name: 'myApp', style: 'scss' },
        appTree
      );
      expect(result.exists('apps/my-app/pages/index.module.scss')).toBeTruthy();
      expect(result.exists('apps/my-app/pages/styles.css')).toBeTruthy();

      const indexContent = result
        .read('apps/my-app/pages/index.tsx')
        .toString();
      expect(indexContent).toContain(
        `import styles from './index.module.scss'`
      );
    });
  });

  describe('--style less', () => {
    it('should generate scss styles', async () => {
      const result = await runSchematic(
        'app',
        { name: 'myApp', style: 'less' },
        appTree
      );
      expect(result.exists('apps/my-app/pages/index.module.less')).toBeTruthy();
      expect(result.exists('apps/my-app/pages/styles.less')).toBeTruthy();

      const indexContent = result
        .read('apps/my-app/pages/index.tsx')
        .toString();
      expect(indexContent).toContain(
        `import styles from './index.module.less'`
      );
    });
  });

  describe('--style styl', () => {
    it('should generate scss styles', async () => {
      const result = await runSchematic(
        'app',
        { name: 'myApp', style: 'styl' },
        appTree
      );
      expect(result.exists('apps/my-app/pages/index.module.styl')).toBeTruthy();
      expect(result.exists('apps/my-app/pages/styles.styl')).toBeTruthy();

      const indexContent = result
        .read('apps/my-app/pages/index.tsx')
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
        result.exists('apps/my-app/pages/index.module.styled-components')
      ).toBeFalsy();
      expect(result.exists('apps/my-app/pages/styles.css')).toBeTruthy();

      const indexContent = result
        .read('apps/my-app/pages/index.tsx')
        .toString();
      expect(indexContent).not.toContain(`import styles from './index.module`);
      expect(indexContent).toContain(`import styled from 'styled-components'`);
    });
  });

  describe('--style @emotion/styled', () => {
    it('should generate scss styles', async () => {
      const result = await runSchematic(
        'app',
        { name: 'myApp', style: '@emotion/styled' },
        appTree
      );
      expect(
        result.exists('apps/my-app/pages/index.module.styled-components')
      ).toBeFalsy();
      expect(result.exists('apps/my-app/pages/styles.css')).toBeTruthy();

      const indexContent = result
        .read('apps/my-app/pages/index.tsx')
        .toString();
      expect(indexContent).not.toContain(`import styles from './index.module`);
      expect(indexContent).toContain(`import styled from '@emotion/styled'`);
    });
  });

  describe('--style styled-jsx', () => {
    it('should use <style jsx> in index page', async () => {
      const result = await runSchematic(
        'app',
        { name: 'myApp', style: 'styled-jsx' },
        appTree
      );

      const indexContent = result
        .read('apps/my-app/pages/index.tsx')
        .toString();

      const babelJestConfig = readJsonInTree(
        result,
        'apps/my-app/babel-jest.config.json'
      );

      expect(indexContent).toMatch(/<style jsx>/);
      expect(babelJestConfig.plugins).toContain('styled-jsx/babel');
      expect(
        result.exists('apps/my-app/pages/index.module.styled-jsx')
      ).toBeFalsy();
      expect(result.exists('apps/my-app/pages/styles.css')).toBeTruthy();

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

  it('should set up the nrwl next build builder', async () => {
    const tree = await runSchematic(
      'app',
      {
        name: 'my-app',
      },
      appTree
    );
    const workspaceJson = readJsonInTree(tree, 'workspace.json');
    const architectConfig = workspaceJson.projects['my-app'].architect;
    expect(architectConfig.build.builder).toEqual('@nrwl/next:build');
    expect(architectConfig.build.options).toEqual({
      root: 'apps/my-app',
      outputPath: 'dist/apps/my-app',
    });
  });

  it('should set up the nrwl next server builder', async () => {
    const tree = await runSchematic(
      'app',
      {
        name: 'my-app',
      },
      appTree
    );
    const workspaceJson = readJsonInTree(tree, 'workspace.json');
    const architectConfig = workspaceJson.projects['my-app'].architect;
    expect(architectConfig.serve.builder).toEqual('@nrwl/next:server');
    expect(architectConfig.serve.options).toEqual({
      buildTarget: 'my-app:build',
      dev: true,
    });
    expect(architectConfig.serve.configurations).toEqual({
      production: { dev: false, buildTarget: 'my-app:build:production' },
    });
  });

  it('should set up the nrwl next export builder', async () => {
    const tree = await runSchematic(
      'app',
      {
        name: 'my-app',
      },
      appTree
    );
    const workspaceJson = readJsonInTree(tree, 'workspace.json');
    const architectConfig = workspaceJson.projects['my-app'].architect;
    expect(architectConfig.export.builder).toEqual('@nrwl/next:export');
    expect(architectConfig.export.options).toEqual({
      buildTarget: 'my-app:build:production',
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

  it('should generate functional components by default', async () => {
    const tree = await runSchematic('app', { name: 'myApp' }, appTree);

    const appContent = tree.read('apps/my-app/pages/index.tsx').toString();

    expect(appContent).not.toMatch(/extends Component/);
  });

  describe('--linter=eslint', () => {
    it('should add .eslintrc.json and dependencies', async () => {
      const tree = await runSchematic(
        'app',
        { name: 'myApp', linter: 'eslint' },
        appTree
      );

      const eslintJson = readJsonInTree(tree, '/apps/my-app/.eslintrc.json');
      const packageJson = readJsonInTree(tree, '/package.json');

      expect(eslintJson.extends).toEqual(
        expect.arrayContaining(['plugin:@nrwl/nx/react'])
      );
      expect(packageJson).toMatchObject({
        devDependencies: {
          'eslint-plugin-react': expect.anything(),
          'eslint-plugin-react-hooks': expect.anything(),
        },
      });
    });
  });
});
