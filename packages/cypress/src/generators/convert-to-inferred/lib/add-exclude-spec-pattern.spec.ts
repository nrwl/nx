import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import { addExcludeSpecPattern } from './add-exclude-spec-pattern';

describe('addExcludeSpecPattern', () => {
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

  it('should add excludeSpecPattern string if it does not exist', () => {
    // ACT
    addExcludeSpecPattern(tree, configFilePath, 'mytests/**/*.spec.ts');

    // ASSERT
    expect(tree.read(configFilePath, 'utf-8')).toMatchInlineSnapshot(`
      "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
      import { defineConfig } from 'cypress';

      export default defineConfig({
        e2e: {excludeSpecPattern: "mytests/**/*.spec.ts",
          ...nxE2EPreset(__filename, { cypressDir: 'src' }),
          baseUrl: "http://localhost:4200",
        },
      });"
    `);
  });

  it('should add excludeSpecPattern array if it does not exist', () => {
    // ACT
    addExcludeSpecPattern(tree, configFilePath, [
      'mytests/**/*.spec.ts',
      'mysecondtests/**/*.spec.ts',
    ]);

    // ASSERT
    expect(tree.read(configFilePath, 'utf-8')).toMatchInlineSnapshot(`
      "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
      import { defineConfig } from 'cypress';

      export default defineConfig({
        e2e: {excludeSpecPattern: ["mytests/**/*.spec.ts","mysecondtests/**/*.spec.ts"],
          ...nxE2EPreset(__filename, { cypressDir: 'src' }),
          baseUrl: "http://localhost:4200",
        },
      });"
    `);
  });

  it('should update the existing excludeSpecPattern if one exists when using string', () => {
    // ARRANGE
    tree.write(
      configFilePath,
      `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, { cypressDir: 'src' }),
    baseUrl: "http://localhost:4200",
    excludeSpecPattern: "somefile.spec.ts"
  },
});`
    );

    // ACT
    addExcludeSpecPattern(tree, configFilePath, 'mytests/**/*.spec.ts');

    // ASSERT
    expect(tree.read(configFilePath, 'utf-8')).toMatchInlineSnapshot(`
      "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
      import { defineConfig } from 'cypress';

      export default defineConfig({
        e2e: {
          ...nxE2EPreset(__filename, { cypressDir: 'src' }),
          baseUrl: "http://localhost:4200",
          excludeSpecPattern: ["mytests/**/*.spec.ts"]
        },
      });"
    `);
  });

  it('should update the existing excludeSpecPattern if one exists when using array', () => {
    // ARRANGE
    tree.write(
      configFilePath,
      `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, { cypressDir: 'src' }),
    baseUrl: "http://localhost:4200",
    excludeSpecPattern: ["somefile.spec.ts"]
  },
});`
    );

    // ACT
    addExcludeSpecPattern(tree, configFilePath, ['mytests/**/*.spec.ts']);

    // ASSERT
    expect(tree.read(configFilePath, 'utf-8')).toMatchInlineSnapshot(`
      "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
      import { defineConfig } from 'cypress';

      export default defineConfig({
        e2e: {
          ...nxE2EPreset(__filename, { cypressDir: 'src' }),
          baseUrl: "http://localhost:4200",
          excludeSpecPattern: ["mytests/**/*.spec.ts"]
        },
      });"
    `);
  });

  it('should update the existing excludeSpecPattern if one exists when using string with an array of new options', () => {
    // ARRANGE
    tree.write(
      configFilePath,
      `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, { cypressDir: 'src' }),
    baseUrl: "http://localhost:4200",
    excludeSpecPattern: "somefile.spec.ts"
  },
});`
    );

    // ACT
    addExcludeSpecPattern(tree, configFilePath, [
      'mytests/**/*.spec.ts',
      'mysecondtests/**/*.spec.ts',
    ]);

    // ASSERT
    expect(tree.read(configFilePath, 'utf-8')).toMatchInlineSnapshot(`
      "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
      import { defineConfig } from 'cypress';

      export default defineConfig({
        e2e: {
          ...nxE2EPreset(__filename, { cypressDir: 'src' }),
          baseUrl: "http://localhost:4200",
          excludeSpecPattern: ["mytests/**/*.spec.ts","mysecondtests/**/*.spec.ts"]
        },
      });"
    `);
  });

  it('should update the existing excludeSpecPattern if one exists when using array with a new pattern string', () => {
    // ARRANGE
    tree.write(
      configFilePath,
      `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, { cypressDir: 'src' }),
    baseUrl: "http://localhost:4200",
    excludeSpecPattern: ["somefile.spec.ts"]
  },
});`
    );

    // ACT
    addExcludeSpecPattern(tree, configFilePath, 'mytests/**/*.spec.ts');

    // ASSERT
    expect(tree.read(configFilePath, 'utf-8')).toMatchInlineSnapshot(`
      "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
      import { defineConfig } from 'cypress';

      export default defineConfig({
        e2e: {
          ...nxE2EPreset(__filename, { cypressDir: 'src' }),
          baseUrl: "http://localhost:4200",
          excludeSpecPattern: ["mytests/**/*.spec.ts"]
        },
      });"
    `);
  });
});
