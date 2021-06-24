import type { Tree } from '@nrwl/devkit';
import * as devkit from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { applicationGenerator } from '../application/application';
import { webWorkerGenerator } from './web-worker';

describe('webWorker generator', () => {
  let tree: Tree;
  const appName = 'ng-app1';

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    await applicationGenerator(tree, { name: appName });
    jest.clearAllMocks();
  });

  it('should generate files', async () => {
    await webWorkerGenerator(tree, { name: 'test-worker', project: appName });

    expect(tree.exists(`apps/${appName}/tsconfig.worker.json`));
    expect(tree.exists(`apps/${appName}/src/app/test-worker.worker.ts`));
  });

  it('should extend from tsconfig.base.json', async () => {
    await webWorkerGenerator(tree, { name: 'test-worker', project: appName });

    expect(
      tree.read(`apps/${appName}/tsconfig.worker.json`, 'utf-8')
    ).toContain('"extends": "../../tsconfig.base.json"');
  });

  it('should format files', async () => {
    jest.spyOn(devkit, 'formatFiles');

    await webWorkerGenerator(tree, { name: 'test-worker', project: appName });

    expect(devkit.formatFiles).toHaveBeenCalled();
  });

  it('should not format files when --skipFormat=true', async () => {
    jest.spyOn(devkit, 'formatFiles');

    await webWorkerGenerator(tree, {
      name: 'test-worker',
      project: appName,
      skipFormat: true,
    });

    expect(devkit.formatFiles).not.toHaveBeenCalled();
  });
});
