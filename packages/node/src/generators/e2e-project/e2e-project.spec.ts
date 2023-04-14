import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { applicationGenerator } from '../application/application';
import { e2eProjectGenerator } from './e2e-project';

describe('e2eProjectGenerator', () => {
  let tree: Tree;
  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should generate default spec for server app (integrated)', async () => {
    await applicationGenerator(tree, {
      name: 'api',
      framework: 'express',
      e2eTestRunner: 'none',
    });
    await e2eProjectGenerator(tree, {
      projectType: 'server',
      project: 'api',
    });

    expect(tree.exists(`api-e2e/src/api/api.spec.ts`)).toBeTruthy();
  });

  it('should generate default spec for server app (standalone)', async () => {
    await applicationGenerator(tree, {
      name: 'api',
      framework: 'express',
      e2eTestRunner: 'none',
      rootProject: true,
    });
    await e2eProjectGenerator(tree, {
      projectType: 'server',
      project: 'api',
      rootProject: true,
    });

    expect(tree.exists(`e2e/src/server/server.spec.ts`)).toBeTruthy();
  });

  it('should generate cli project', async () => {
    await applicationGenerator(tree, {
      name: 'api',
      framework: 'none',
      e2eTestRunner: 'none',
    });
    await e2eProjectGenerator(tree, {
      projectType: 'cli',
      project: 'api',
    });
    expect(tree.read('api-e2e/src/api/api.spec.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { execSync } from 'child_process';
      import { join } from 'path';

      describe('CLI tests', () => {
        it('should print a message', () => {
          const cliPath = join(process.cwd(), 'dist/api');

          const output = execSync(\`node \${cliPath}\`).toString();

          expect(output).toMatch(/Hello World/);
        });
      });
      "
    `);
  });
});
