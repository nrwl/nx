import type { Tree } from '@nx/devkit';
import * as devkit from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { generateTestApplication } from '../utils/testing';
import { webWorkerGenerator } from './web-worker';

describe('webWorker generator', () => {
  let tree: Tree;
  const appName = 'ng-app1';

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await generateTestApplication(tree, { name: appName });
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

  it('should extend from tsconfig.json when used instead of tsconfig.base.json', async () => {
    tree.rename('tsconfig.base.json', 'tsconfig.json');

    await webWorkerGenerator(tree, { name: 'test-worker', project: appName });

    expect(
      tree.read(`apps/${appName}/tsconfig.worker.json`, 'utf-8')
    ).toContain('"extends": "../../tsconfig.json"');
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

  it('should add the snippet correctly', async () => {
    // ARRANGE
    tree.write(`apps/${appName}/src/app/test-worker.ts`, ``);

    // ACT
    await webWorkerGenerator(tree, {
      name: 'test-worker',
      project: appName,
      snippet: true,
    });

    // ASSERT
    expect(tree.read(`apps/${appName}/src/app/test-worker.ts`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "if (typeof Worker !== 'undefined') {
        // Create a new
        const worker = new Worker(new URL('./test-worker.worker', import.meta.url));
        worker.onmessage = ({ data }) => {
          console.log(\`page got message \${data}\`);
        };
        worker.postMessage('hello');
      } else {
        // Web Workers are not supported in this environment.
        // You should add a fallback so that your program still executes correctly.
      }
      "
    `);
    expect(tree.read(`apps/${appName}/src/app/test-worker.worker.ts`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "/// <reference lib="webworker" />

      addEventListener('message', ({ data }) => {
        const response = \`worker response to \${data}\`;
        postMessage(response);
      });
      "
    `);
  });
});
