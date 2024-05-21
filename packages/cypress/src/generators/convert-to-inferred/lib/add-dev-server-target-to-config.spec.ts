import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import { addDevServerTargetToConfig } from './add-dev-server-target-to-config';

describe('addDevServerTargetToConfig', () => {
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

  describe('devServerTarget only', () => {
    it('should add webServerCommands when it does not exist', () => {
      // ACT
      addDevServerTargetToConfig(tree, configFilePath, {
        default: 'npx nx run myorg:serve',
      });

      // ASSERT
      expect(tree.read(configFilePath, 'utf-8')).toMatchInlineSnapshot(`
        "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
        import { defineConfig } from 'cypress';

        export default defineConfig({
          e2e: {
            ...nxE2EPreset(__filename, {webServerCommands: {"default":"npx nx run myorg:serve"}, cypressDir: 'src' }),
            baseUrl: "http://localhost:4200",
          },
        });"
      `);
    });

    it('should do nothing if the webServerCommands exists and matches the devServerTarget', () => {
      // ARRANGE
      tree.write(
        configFilePath,
        `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, { cypressDir: 'src', webServerCommands: {default: "npx nx run myorg:serve"} }),
    baseUrl: "http://localhost:4200",
  },
});`
      );
      // ACT
      addDevServerTargetToConfig(tree, configFilePath, {
        default: 'npx nx run myorg:serve',
      });

      // ASSERT
      expect(tree.read(configFilePath, 'utf-8')).toMatchInlineSnapshot(`
        "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
        import { defineConfig } from 'cypress';

        export default defineConfig({
          e2e: {
            ...nxE2EPreset(__filename, { cypressDir: 'src', webServerCommands: {"default":"npx nx run myorg:serve"} }),
            baseUrl: "http://localhost:4200",
          },
        });"
      `);
    });

    it('should add options object if it does not exist', () => {
      // ARRANGE
      tree.write(
        configFilePath,
        `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename),
    baseUrl: "http://localhost:4200",
  },
});`
      );
      // ACT
      addDevServerTargetToConfig(
        tree,
        configFilePath,
        {
          default: 'npx nx run myorg:serve',
        },
        'npx nx run myorg:serve-static'
      );

      // ASSERT
      expect(tree.read(configFilePath, 'utf-8')).toMatchInlineSnapshot(`
        "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
        import { defineConfig } from 'cypress';

        export default defineConfig({
          e2e: {
            ...nxE2EPreset(__filename,{ciWebServerCommand: "npx nx run myorg:serve-static", webServerCommands: {"default":"npx nx run myorg:serve"},}),
            baseUrl: "http://localhost:4200",
          },
        });"
      `);
    });

    it('should update the webServerCommands if it does not match', () => {
      // ARRANGE
      tree.write(
        configFilePath,
        `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, { cypressDir: 'src', webServerCommands: {default: "npx nx run test:serve"} }),
    baseUrl: "http://localhost:4200",
  },
});`
      );
      // ACT
      addDevServerTargetToConfig(tree, configFilePath, {
        default: 'npx nx run myorg:serve',
      });

      // ASSERT
      expect(tree.read(configFilePath, 'utf-8')).toMatchInlineSnapshot(`
        "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
        import { defineConfig } from 'cypress';

        export default defineConfig({
          e2e: {
            ...nxE2EPreset(__filename, { cypressDir: 'src', webServerCommands: {"default":"npx nx run myorg:serve"} }),
            baseUrl: "http://localhost:4200",
          },
        });"
      `);
    });
  });

  describe('devServerTarget and ci.devServerTarget', () => {
    it('should add webServerCommands and ciWebServerCommand when it does not exist', () => {
      // ACT
      addDevServerTargetToConfig(
        tree,
        configFilePath,
        { default: 'npx nx run myorg:serve' },
        'npx nx run myorg:static-serve'
      );

      // ASSERT
      expect(tree.read(configFilePath, 'utf-8')).toMatchInlineSnapshot(`
        "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
        import { defineConfig } from 'cypress';

        export default defineConfig({
          e2e: {
            ...nxE2EPreset(__filename, {ciWebServerCommand: "npx nx run myorg:static-serve",webServerCommands: {"default":"npx nx run myorg:serve"}, cypressDir: 'src' }),
            baseUrl: "http://localhost:4200",
          },
        });"
      `);
    });

    it('should do nothing if the webServerCommands and ciWebServerCommand exists and matches the devServerTarget', () => {
      // ARRANGE
      tree.write(
        configFilePath,
        `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, { cypressDir: 'src', webServerCommands: {default: "npx nx run myorg:serve"}, ciWebServerCommand: "npx nx run myorg:static-serve" }),
    baseUrl: "http://localhost:4200",
  },
});`
      );
      // ACT
      addDevServerTargetToConfig(
        tree,
        configFilePath,
        { default: 'npx nx run myorg:serve' },
        'npx nx run myorg:static-serve'
      );

      // ASSERT
      expect(tree.read(configFilePath, 'utf-8')).toMatchInlineSnapshot(`
        "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
        import { defineConfig } from 'cypress';

        export default defineConfig({
          e2e: {
            ...nxE2EPreset(__filename, { cypressDir: 'src', webServerCommands: {"default":"npx nx run myorg:serve"}, ciWebServerCommand: "npx nx run myorg:static-serve" }),
            baseUrl: "http://localhost:4200",
          },
        });"
      `);
    });

    it('should update the webServerCommands and ciWebServerCommand if it does not match', () => {
      // ARRANGE
      tree.write(
        configFilePath,
        `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, { cypressDir: 'src', webServerCommands: {default: "npx nx run test:serve"}, ciWebServerCommand: "npx nx run test:static-serve" }),
    baseUrl: "http://localhost:4200",
  },
});`
      );
      // ACT
      addDevServerTargetToConfig(
        tree,
        configFilePath,
        {
          default: 'npx nx run myorg:serve',
          production: 'npx nx run myorg:serve:production',
          ci: 'npx nx run myorg-static-serve',
        },
        'npx nx run myorg:static-serve'
      );

      // ASSERT
      expect(tree.read(configFilePath, 'utf-8')).toMatchInlineSnapshot(`
        "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
        import { defineConfig } from 'cypress';

        export default defineConfig({
          e2e: {
            ...nxE2EPreset(__filename, { cypressDir: 'src', webServerCommands: {"default":"npx nx run myorg:serve","production":"npx nx run myorg:serve:production","ci":"npx nx run myorg-static-serve"}, ciWebServerCommand: "npx nx run myorg:static-serve" }),
            baseUrl: "http://localhost:4200",
          },
        });"
      `);
    });
  });
});
