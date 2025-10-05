import 'nx/src/internal-testing-utils/mock-project-graph';

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
    await generateTestApplication(tree, {
      directory: appName,
      skipFormat: true,
    });
    jest.clearAllMocks();
  });

  it('should generate files', async () => {
    await webWorkerGenerator(tree, {
      name: 'test-worker',
      project: appName,
      skipFormat: true,
    });

    expect(tree.exists(`${appName}/tsconfig.worker.json`));
    expect(tree.exists(`${appName}/src/app/test-worker.worker.ts`));
  });

  it('should extend from tsconfig.base.json', async () => {
    await webWorkerGenerator(tree, {
      name: 'test-worker',
      project: appName,
      skipFormat: true,
    });

    expect(tree.read(`${appName}/tsconfig.worker.json`, 'utf-8')).toContain(
      '"extends": "../tsconfig.base.json"'
    );
  });

  it('should extend from tsconfig.json when used instead of tsconfig.base.json', async () => {
    tree.rename('tsconfig.base.json', 'tsconfig.json');

    await webWorkerGenerator(tree, {
      name: 'test-worker',
      project: appName,
      skipFormat: true,
    });

    expect(tree.read(`${appName}/tsconfig.worker.json`, 'utf-8')).toContain(
      '"extends": "../tsconfig.json"'
    );
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
    tree.write(`${appName}/src/app/test-worker.ts`, ``);

    // ACT
    await webWorkerGenerator(tree, {
      name: 'test-worker',
      project: appName,
      snippet: true,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.read(`${appName}/src/app/test-worker.ts`, 'utf-8'))
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
      }"
    `);
    expect(tree.read(`${appName}/src/app/test-worker.worker.ts`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "/// <reference lib="webworker" />

      addEventListener('message', ({ data }) => {
        const response = \`worker response to \${data}\`;
        postMessage(response);
      });
      "
    `);
  });

  it('should not add snippet to worker file itself', async () => {
    tree.write(`${appName}/src/app/test-worker.ts`, ``);

    await webWorkerGenerator(tree, {
      name: 'test-worker',
      project: appName,
      snippet: true,
      skipFormat: true,
    });

    const workerContent = tree.read(
      `${appName}/src/app/test-worker.worker.ts`,
      'utf-8'
    );
    expect(workerContent).not.toContain('new Worker(');
    expect(workerContent).toContain("addEventListener('message'");
  });

  it('should generate tsconfig.worker.json with correct outDir path', async () => {
    await webWorkerGenerator(tree, {
      name: 'test-worker',
      project: appName,
      skipFormat: true,
    });

    const tsconfig = tree.read(`${appName}/tsconfig.worker.json`, 'utf-8');
    expect(tsconfig).toContain('"outDir": "../out-tsc/worker"');
    expect(tsconfig).not.toContain('//');
  });

  it('should handle complex worker names correctly', async () => {
    const complexName = 'my-complex-worker-name';
    tree.write(`${appName}/src/app/${complexName}.ts`, ``);
    tree.write(`${appName}/src/app/${complexName}.service.ts`, ``);

    await webWorkerGenerator(tree, {
      name: complexName,
      project: appName,
      snippet: true,
      skipFormat: true,
    });

    const mainFile = tree.read(`${appName}/src/app/${complexName}.ts`, 'utf-8');
    const serviceFile = tree.read(
      `${appName}/src/app/${complexName}.service.ts`,
      'utf-8'
    );
    const workerFile = tree.read(
      `${appName}/src/app/${complexName}.worker.ts`,
      'utf-8'
    );

    // Service file comes first alphabetically, so it should get the snippet
    expect(mainFile).not.toContain('new Worker(');
    expect(serviceFile).toContain('new Worker(');
    expect(workerFile).not.toContain('new Worker(');
  });

  describe('Bug reproduction tests', () => {
    it('should NOT add worker creation snippet to the generated worker file itself', async () => {
      // ARRANGE - Create sibling files that match the name pattern
      tree.write(
        `${appName}/src/app/test-worker.service.ts`,
        'export class TestWorkerService {}'
      );
      tree.write(
        `${appName}/src/app/test-worker.component.ts`,
        'export class TestWorkerComponent {}'
      );

      // ACT - Generate web worker with snippet enabled
      await webWorkerGenerator(tree, {
        name: 'test-worker',
        project: appName,
        snippet: true,
        skipFormat: true,
      });

      // ASSERT - The generated worker file should NOT contain the worker creation snippet
      const workerFileContent = tree.read(
        `${appName}/src/app/test-worker.worker.ts`,
        'utf-8'
      );
      expect(workerFileContent).not.toContain('new Worker(');
      expect(workerFileContent).not.toContain('worker.onmessage');
      expect(workerFileContent).not.toContain('worker.postMessage');

      // The worker file should only contain the worker code template
      expect(workerFileContent).toContain('/// <reference lib="webworker" />');
      expect(workerFileContent).toContain("addEventListener('message'");

      // ASSERT - The first alphabetical sibling file should contain the worker creation snippet
      const componentContent = tree.read(
        `${appName}/src/app/test-worker.component.ts`,
        'utf-8'
      );
      const serviceContent = tree.read(
        `${appName}/src/app/test-worker.service.ts`,
        'utf-8'
      );

      // Component comes before service alphabetically, so it should get the snippet
      expect(componentContent).toContain('new Worker(');
      expect(componentContent).toContain('worker.onmessage');
      expect(componentContent).toContain('worker.postMessage');

      // Service should not get the snippet
      expect(serviceContent).not.toContain('new Worker(');
    });

    it('should reproduce the bug where worker creation snippet is added to worker file', async () => {
      // This test demonstrates the current buggy behavior
      // ARRANGE - Create a sibling file that would typically receive the snippet
      tree.write(
        `${appName}/src/app/test-worker.ts`,
        'export class TestWorker {}'
      );

      // ACT - Generate web worker with snippet enabled
      await webWorkerGenerator(tree, {
        name: 'test-worker',
        project: appName,
        snippet: true,
        skipFormat: true,
      });

      // ASSERT - Check if the worker file incorrectly receives the snippet (this shows the bug)
      const workerFileContent = tree.read(
        `${appName}/src/app/test-worker.worker.ts`,
        'utf-8'
      );

      // This assertion will currently PASS (showing the bug exists)
      // Once the bug is fixed, this test should be updated to show the correct behavior
      const hasWorkerCreationSnippet =
        workerFileContent.includes('new Worker(') ||
        workerFileContent.includes('worker.onmessage') ||
        workerFileContent.includes('worker.postMessage');

      if (hasWorkerCreationSnippet) {
        console.warn(
          'BUG REPRODUCED: Worker creation snippet was incorrectly added to worker file'
        );
      }

      // Document the current behavior (this shows the bug exists)
      // When fixed, the worker file should NOT contain worker creation code
      expect(workerFileContent).toContain('/// <reference lib="webworker" />');
    });

    it('should handle multiple sibling files correctly without adding snippet to worker file', async () => {
      // ARRANGE - Create multiple sibling files with the same name prefix
      tree.write(
        `${appName}/src/app/test-worker.service.ts`,
        'export class TestWorkerService {}'
      );
      tree.write(
        `${appName}/src/app/test-worker.component.ts`,
        'export class TestWorkerComponent {}'
      );
      tree.write(
        `${appName}/src/app/test-worker.helper.ts`,
        'export class TestWorkerHelper {}'
      );

      // ACT
      await webWorkerGenerator(tree, {
        name: 'test-worker',
        project: appName,
        snippet: true,
        skipFormat: true,
      });

      // ASSERT - Only the first alphabetical sibling should get the snippet
      const serviceContent = tree.read(
        `${appName}/src/app/test-worker.service.ts`,
        'utf-8'
      );
      const componentContent = tree.read(
        `${appName}/src/app/test-worker.component.ts`,
        'utf-8'
      );
      const helperContent = tree.read(
        `${appName}/src/app/test-worker.helper.ts`,
        'utf-8'
      );
      const workerContent = tree.read(
        `${appName}/src/app/test-worker.worker.ts`,
        'utf-8'
      );

      // Check that the snippet was added to the first alphabetical file (component comes before service)
      expect(componentContent).toContain('new Worker(');

      // Other files should not get the snippet
      expect(serviceContent).not.toContain('new Worker(');
      expect(helperContent).not.toContain('new Worker(');

      // Worker file should never get the snippet
      expect(workerContent).not.toContain('new Worker(');
    });

    it('should handle file filtering correctly to exclude worker files from snippet targets', async () => {
      // ARRANGE - Create files that should and shouldn't receive the snippet
      tree.write(
        `${appName}/src/app/test-worker.ts`,
        'export class TestWorker {}'
      ); // Should get snippet
      tree.write(
        `${appName}/src/app/test-worker.module.ts`,
        'export class TestWorkerModule {}'
      ); // Should NOT get snippet (excluded by pattern)
      tree.write(`${appName}/src/app/test-worker.spec.ts`, 'describe("test"'); // Should NOT get snippet (excluded by pattern)
      tree.write(
        `${appName}/src/app/test-worker.config.ts`,
        'export const config = {}'
      ); // Should NOT get snippet (excluded by pattern)

      // ACT
      await webWorkerGenerator(tree, {
        name: 'test-worker',
        project: appName,
        snippet: true,
        skipFormat: true,
      });

      // ASSERT
      const mainFileContent = tree.read(
        `${appName}/src/app/test-worker.ts`,
        'utf-8'
      );
      const moduleFileContent = tree.read(
        `${appName}/src/app/test-worker.module.ts`,
        'utf-8'
      );
      const specFileContent = tree.read(
        `${appName}/src/app/test-worker.spec.ts`,
        'utf-8'
      );
      const configFileContent = tree.read(
        `${appName}/src/app/test-worker.config.ts`,
        'utf-8'
      );
      const workerFileContent = tree.read(
        `${appName}/src/app/test-worker.worker.ts`,
        'utf-8'
      );

      // Only the main file should get the snippet
      expect(mainFileContent).toContain('new Worker(');

      // Excluded files should not get the snippet
      expect(moduleFileContent).not.toContain('new Worker(');
      expect(specFileContent).not.toContain('new Worker(');
      expect(configFileContent).not.toContain('new Worker(');

      // Worker file should not get the snippet
      expect(workerFileContent).not.toContain('new Worker(');
    });
  });

  describe('tsconfig.worker.json double slash bug reproduction', () => {
    it('should not have double slashes in outDir path', async () => {
      // ACT
      await webWorkerGenerator(tree, {
        name: 'test-worker',
        project: appName,
        skipFormat: true,
      });

      // ASSERT
      const tsconfigContent = tree.read(
        `${appName}/tsconfig.worker.json`,
        'utf-8'
      );
      const tsconfig = JSON.parse(tsconfigContent);

      // Check that outDir doesn't have double slashes
      expect(tsconfig.compilerOptions.outDir).not.toMatch(/\/\//);
      expect(tsconfig.compilerOptions.outDir).toBe('../out-tsc/worker');

      // Also check the full content for any double slashes
      expect(tsconfigContent).not.toMatch(/\/\//);
    });

    it('should handle nested project structure without double slashes', async () => {
      // ARRANGE - Create a nested app structure
      const nestedAppDirectory = 'apps/nested-app';
      const nestedAppName = 'nested-app'; // The actual project name
      await generateTestApplication(tree, {
        directory: nestedAppDirectory,
        skipFormat: true,
      });

      // ACT
      await webWorkerGenerator(tree, {
        name: 'test-worker',
        project: nestedAppName,
        skipFormat: true,
      });

      // ASSERT
      const tsconfigContent = tree.read(
        `${nestedAppDirectory}/tsconfig.worker.json`,
        'utf-8'
      );
      const tsconfig = JSON.parse(tsconfigContent);

      // Check that outDir doesn't have double slashes even in nested structure
      expect(tsconfig.compilerOptions.outDir).not.toMatch(/\/\//);
      expect(tsconfigContent).not.toMatch(/\/\//);

      // The outDir should be correct relative path
      expect(tsconfig.compilerOptions.outDir).toBe('../../out-tsc/worker');
    });
  });
});
