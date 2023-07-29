import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { tsquery } from '@phenomnomnominal/tsquery';
import {
  buildOption,
  buildOptionObject,
  conditionalConfig,
  configNoDefineConfig,
  dtsImportLine,
  dtsPlugin,
  hasEverything,
  noBuildOptions,
  noBuildOptionsHasTestOption,
  noContentDefineConfig,
  pluginOption,
  someBuildOptions,
  someBuildOptionsSomeTestOption,
  testOption,
  testOptionObject,
} from './test-files/test-vite-configs';
import { ensureViteConfigIsCorrect } from './vite-config-edit-utils';

describe('ensureViteConfigIsCorrect', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it("should add build options if build options don't exist", () => {
    tree.write('apps/my-app/vite.config.ts', noBuildOptions);
    ensureViteConfigIsCorrect(
      tree,
      'apps/my-app/vite.config.ts',
      buildOption,
      buildOptionObject,
      dtsPlugin,
      dtsImportLine,
      pluginOption,
      testOption,
      testOptionObject,
      '',
      { build: false, test: true, serve: false }
    );
    const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
    const file = tsquery.ast(appFileContent);
    const buildNode = tsquery.query(
      file,
      'PropertyAssignment:has(Identifier[name="build"])'
    );
    expect(buildNode).toBeDefined();
    expect(appFileContent).toMatchSnapshot();
  });

  it('should add new build options if some build options already exist', () => {
    tree.write('apps/my-app/vite.config.ts', someBuildOptions);
    ensureViteConfigIsCorrect(
      tree,
      'apps/my-app/vite.config.ts',
      buildOption,
      buildOptionObject,
      dtsPlugin,
      dtsImportLine,
      pluginOption,
      testOption,
      testOptionObject,
      '',
      { build: false, test: true, serve: false }
    );
    const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
    const file = tsquery.ast(appFileContent);
    const buildNode = tsquery.query(
      file,
      'PropertyAssignment:has(Identifier[name="build"])'
    );
    expect(buildNode).toBeDefined();
    expect(appFileContent).toMatchSnapshot();
  });

  it('should add build and test options if defineConfig is empty', () => {
    tree.write('apps/my-app/vite.config.ts', noContentDefineConfig);
    ensureViteConfigIsCorrect(
      tree,
      'apps/my-app/vite.config.ts',
      buildOption,
      buildOptionObject,
      dtsPlugin,
      dtsImportLine,
      pluginOption,
      testOption,
      testOptionObject,
      '',
      { build: false, test: false, serve: false }
    );
    const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
    const file = tsquery.ast(appFileContent);
    const buildNode = tsquery.query(
      file,
      'PropertyAssignment:has(Identifier[name="build"])'
    );
    expect(buildNode).toBeDefined();
    expect(appFileContent).toMatchSnapshot();
  });

  it('should add build options if it is using conditional config - do nothing for test', () => {
    tree.write('apps/my-app/vite.config.ts', conditionalConfig);
    ensureViteConfigIsCorrect(
      tree,
      'apps/my-app/vite.config.ts',
      buildOption,
      buildOptionObject,
      dtsPlugin,
      dtsImportLine,
      pluginOption,
      testOption,
      testOptionObject,
      '',
      { build: false, test: false, serve: false }
    );
    const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
    const file = tsquery.ast(appFileContent);
    const buildNode = tsquery.query(
      file,
      'PropertyAssignment:has(Identifier[name="build"])'
    );
    expect(buildNode).toBeDefined();
    expect(appFileContent).toMatchSnapshot();
  });

  it('should add build options if defineConfig is not used', () => {
    tree.write('apps/my-app/vite.config.ts', configNoDefineConfig);
    ensureViteConfigIsCorrect(
      tree,
      'apps/my-app/vite.config.ts',
      buildOption,
      buildOptionObject,
      dtsPlugin,
      dtsImportLine,
      pluginOption,
      testOption,
      testOptionObject,
      '',
      { build: false, test: false, serve: false }
    );
    const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
    const file = tsquery.ast(appFileContent);
    const buildNode = tsquery.query(
      file,
      'PropertyAssignment:has(Identifier[name="build"])'
    );
    expect(buildNode).toBeDefined();
    expect(appFileContent).toMatchSnapshot();
  });

  it('should not do anything if cannot understand syntax of vite config', () => {
    tree.write('apps/my-app/vite.config.ts', `console.log('Unknown syntax')`);
    ensureViteConfigIsCorrect(
      tree,
      'apps/my-app/vite.config.ts',
      buildOption,
      buildOptionObject,
      dtsPlugin,
      dtsImportLine,
      pluginOption,
      testOption,
      testOptionObject,
      '',
      { build: false, test: false, serve: false }
    );
    const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
    expect(appFileContent).toMatchSnapshot();
  });

  it('should not do anything if project has everything setup already', () => {
    tree.write('apps/my-app/vite.config.ts', hasEverything);
    ensureViteConfigIsCorrect(
      tree,
      'apps/my-app/vite.config.ts',
      buildOption,
      buildOptionObject,
      dtsPlugin,
      dtsImportLine,
      pluginOption,
      testOption,
      testOptionObject,
      '',
      { build: true, test: true, serve: true }
    );
    const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
    expect(appFileContent).toMatchSnapshot();
  });

  it('should add build option but not update test option if test already setup', () => {
    tree.write('apps/my-app/vite.config.ts', noBuildOptionsHasTestOption);
    ensureViteConfigIsCorrect(
      tree,
      'apps/my-app/vite.config.ts',
      buildOption,
      buildOptionObject,
      dtsPlugin,
      dtsImportLine,
      pluginOption,
      testOption,
      testOptionObject,
      '',
      { build: false, test: true, serve: true }
    );
    const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
    expect(appFileContent).toMatchSnapshot();
  });

  it('should update both test and build options - keep existing settings', () => {
    tree.write('apps/my-app/vite.config.ts', someBuildOptionsSomeTestOption);
    ensureViteConfigIsCorrect(
      tree,
      'apps/my-app/vite.config.ts',
      buildOption,
      buildOptionObject,
      dtsPlugin,
      dtsImportLine,
      pluginOption,
      testOption,
      testOptionObject,
      '',
      { build: false, test: false, serve: true }
    );
    const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
    expect(appFileContent).toMatchSnapshot();
  });
});
