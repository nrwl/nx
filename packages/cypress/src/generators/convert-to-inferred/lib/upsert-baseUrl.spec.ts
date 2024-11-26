import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import { upsertBaseUrl } from './upsert-baseUrl';

describe('upsertBaseUrl', () => {
  let tree: Tree;
  const configFilePath = 'cypress.config.ts';
  const configFileContents = `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, { cypressDir: 'src' }),
    baseUrl: "http://localhost:4200",
  },
});`;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write(configFilePath, configFileContents);
  });

  it('should do nothing if the baseUrl value exists and matches', () => {
    // ACT
    upsertBaseUrl(tree, configFilePath, 'http://localhost:4200');

    // ASSERT
    expect(tree.read(configFilePath, 'utf-8')).toEqual(configFileContents);
  });

  it('should update the config if the baseUrl value exists and does not match', () => {
    // ACT
    upsertBaseUrl(tree, configFilePath, 'http://localhost:4201');

    // ASSERT
    expect(tree.read(configFilePath, 'utf-8')).toMatchInlineSnapshot(`
      "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
      import { defineConfig } from 'cypress';

      export default defineConfig({
        e2e: {
          ...nxE2EPreset(__filename, { cypressDir: 'src' }),
          baseUrl: "http://localhost:4201",
        },
      });"
    `);
  });

  it('should add the baseUrl property if it does not exist', () => {
    // ARRANGE
    tree.write(
      configFilePath,
      `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, { cypressDir: 'src' }),
  },
});`
    );
    // ACT
    upsertBaseUrl(tree, configFilePath, 'http://localhost:4200');

    // ASSERT
    expect(tree.read(configFilePath, 'utf-8')).toMatchInlineSnapshot(`
      "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
      import { defineConfig } from 'cypress';

      export default defineConfig({
        e2e: {
          ...nxE2EPreset(__filename, { cypressDir: 'src' }),
        baseUrl: "http://localhost:4200",
              },
      });"
    `);
  });
});
