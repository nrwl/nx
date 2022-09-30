import {
  Tree,
  readWorkspaceConfiguration,
  getProjects,
  readJson,
  readProjectConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { reactNativeApplicationGenerator } from './application';

describe('app', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace();
    appTree.write('.gitignore', '');
  });

  it('should update workspace.json', async () => {
    await reactNativeApplicationGenerator(appTree, {
      name: 'myApp',
      displayName: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      install: false,
    });
    const workspaceJson = readWorkspaceConfiguration(appTree);
    const projects = getProjects(appTree);

    expect(projects.get('my-app').root).toEqual('apps/my-app');
    expect(workspaceJson.defaultProject).toEqual('my-app');
  });

  it('should update nx.json', async () => {
    await reactNativeApplicationGenerator(appTree, {
      name: 'myApp',
      displayName: 'myApp',
      tags: 'one,two',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      install: false,
    });

    const projectConfiguration = readProjectConfiguration(appTree, 'my-app');
    expect(projectConfiguration).toMatchObject({
      tags: ['one', 'two'],
    });
  });

  it('should generate files', async () => {
    await reactNativeApplicationGenerator(appTree, {
      name: 'myApp',
      displayName: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      install: false,
    });
    expect(appTree.exists('apps/my-app/src/app/App.tsx')).toBeTruthy();
    expect(appTree.exists('apps/my-app/src/main.tsx')).toBeTruthy();

    const tsconfig = readJson(appTree, 'apps/my-app/tsconfig.json');
    expect(tsconfig.extends).toEqual('../../tsconfig.base.json');

    expect(appTree.exists('apps/my-app/.eslintrc.json')).toBe(true);
  });

  it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
    appTree.rename('tsconfig.base.json', 'tsconfig.json');

    await reactNativeApplicationGenerator(appTree, {
      name: 'myApp',
      displayName: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      install: false,
    });

    const tsconfig = readJson(appTree, 'apps/my-app/tsconfig.json');
    expect(tsconfig.extends).toEqual('../../tsconfig.json');
  });
  it('should create e2e app with correct paths', async () => {
    await reactNativeApplicationGenerator(appTree, {
      name: 'myApp',
      displayName: 'myAppWithDisplayName',
      directory: 'myDir',
      linter: Linter.EsLint,
      e2eTestRunner: 'detox',
      install: false,
    });

    expect(appTree.exists('apps/my-dir/my-app-e2e/.detoxrc.json')).toBeTruthy();
    const detoxrc = appTree.read(
      'apps/my-dir/my-app-e2e/.detoxrc.json',
      'utf-8'
    );
    // Strip trailing commas
    const detoxrcJson = JSON.parse(
      detoxrc.replace(/(?<=(true|false|null|["\d}\]])\s*),(?=\s*[}\]])/g, '')
    );
    expect(detoxrcJson.apps['ios.debug'].build).toEqual(
      `cd ../../../apps/my-dir/my-app/ios && xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 13' -derivedDataPath ./build -quiet`
    );
  });
});
