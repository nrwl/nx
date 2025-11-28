import { Tree, writeJson, readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './convert-jest-config-to-cjs';

describe('convert-jest-config-to-cjs', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    // Register @nx/jest/plugin in nx.json - required for migration to run
    const nxJson = readJson(tree, 'nx.json');
    nxJson.plugins = ['@nx/jest/plugin'];
    writeJson(tree, 'nx.json', nxJson);
  });

  describe('export default conversion', () => {
    it('should convert export default to module.exports', async () => {
      tree.write(
        'apps/app1/jest.config.ts',
        `export default {
  displayName: 'app1',
  preset: '../../jest.preset.js',
};`
      );
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });

      await migration(tree);

      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toContain('module.exports =');
      expect(content).not.toContain('export default');
    });

    it('should preserve object content when converting export default', async () => {
      tree.write(
        'apps/app1/jest.config.ts',
        `export default {
  displayName: 'app1',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
};`
      );
      writeJson(tree, 'apps/app1/package.json', { name: 'app1' }); // no type, defaults to CJS

      await migration(tree);

      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toContain("displayName: 'app1'");
      expect(content).toContain("preset: '../../jest.preset.js'");
      expect(content).toContain("testEnvironment: 'node'");
    });
  });

  describe('import conversion', () => {
    it('should convert named imports to require', async () => {
      tree.write(
        'apps/app1/jest.config.ts',
        `import { readFileSync } from 'fs';

export default {
  displayName: 'app1',
};`
      );
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });

      await migration(tree);

      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toContain("const { readFileSync } = require('fs')");
      expect(content).not.toContain('import { readFileSync }');
    });

    it('should convert default imports to require', async () => {
      tree.write(
        'apps/app1/jest.config.ts',
        `import path from 'path';

export default {
  displayName: 'app1',
};`
      );
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });

      await migration(tree);

      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toContain("const path = require('path')");
      expect(content).not.toContain("import path from 'path'");
    });

    it('should convert namespace imports to require', async () => {
      tree.write(
        'apps/app1/jest.config.ts',
        `import * as fs from 'fs';

export default {
  displayName: 'app1',
};`
      );
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });

      await migration(tree);

      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toContain("const fs = require('fs')");
      expect(content).not.toContain("import * as fs from 'fs'");
    });

    it('should convert side-effect imports to require', async () => {
      tree.write(
        'apps/app1/jest.config.ts',
        `import 'reflect-metadata';

export default {
  displayName: 'app1',
};`
      );
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });

      await migration(tree);

      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toContain("require('reflect-metadata')");
      expect(content).not.toContain("import 'reflect-metadata'");
    });

    it('should handle renamed imports', async () => {
      tree.write(
        'apps/app1/jest.config.ts',
        `import { readFileSync as readFile } from 'fs';

export default {
  displayName: 'app1',
};`
      );
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });

      await migration(tree);

      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toContain(
        "const { readFileSync: readFile } = require('fs')"
      );
    });
  });

  describe('ESM module type', () => {
    it('should NOT convert jest.config.ts when project package.json has type: module', async () => {
      const originalContent = `import { readFileSync } from 'fs';

export default {
  displayName: 'app1',
};`;
      tree.write('apps/app1/jest.config.ts', originalContent);
      writeJson(tree, 'apps/app1/package.json', { type: 'module' });

      await migration(tree);

      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toContain('export default');
      expect(content).toContain('import { readFileSync }');
    });

    it('should NOT convert when root package.json has type: module and no project package.json', async () => {
      const originalContent = `export default {
  displayName: 'app1',
};`;
      tree.write('apps/app1/jest.config.ts', originalContent);
      writeJson(tree, 'package.json', { type: 'module' });

      await migration(tree);

      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toContain('export default');
    });

    it('should use project package.json type over root package.json type', async () => {
      tree.write(
        'apps/app1/jest.config.ts',
        `export default {
  displayName: 'app1',
};`
      );
      writeJson(tree, 'package.json', { type: 'commonjs' });
      writeJson(tree, 'apps/app1/package.json', { type: 'module' });

      await migration(tree);

      // Should NOT convert because project-level type: module takes precedence
      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toContain('export default');
    });
  });

  describe('ESM-only features detection', () => {
    it('should NOT convert files with import.meta and warn user', async () => {
      const originalContent = `export default {
  rootDir: import.meta.dirname,
};`;
      tree.write('apps/app1/jest.config.ts', originalContent);
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });

      await migration(tree);

      // File should remain unchanged
      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toContain('export default');
      expect(content).toContain('import.meta');
    });

    it('should NOT convert files with top-level await and warn user', async () => {
      const originalContent = `const config = await import('./base-config.js');

export default {
  ...config.default,
  displayName: 'app1',
};`;
      tree.write('apps/app1/jest.config.ts', originalContent);
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });

      await migration(tree);

      // File should remain unchanged
      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toContain('export default');
      expect(content).toContain('await import');
    });

    it('should convert files with await inside functions (not top-level)', async () => {
      tree.write(
        'apps/app1/jest.config.ts',
        `export default async () => {
  const config = await import('./base-config.js');
  return {
    ...config.default,
    displayName: 'app1',
  };
};`
      );
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });

      await migration(tree);

      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toContain('module.exports =');
      expect(content).not.toContain('export default');
    });
  });

  describe('multiple files', () => {
    it('should handle multiple jest.config.ts files correctly', async () => {
      tree.write(
        'apps/app1/jest.config.ts',
        `export default {
  displayName: 'app1',
};`
      );
      tree.write(
        'apps/app2/jest.config.ts',
        `export default {
  displayName: 'app2',
};`
      );
      tree.write(
        'libs/lib1/jest.config.ts',
        `import { readFileSync } from 'fs';

export default {
  displayName: 'lib1',
};`
      );
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });
      writeJson(tree, 'apps/app2/package.json', { type: 'module' });
      writeJson(tree, 'libs/lib1/package.json', { name: 'lib1' }); // no type, defaults to CJS

      await migration(tree);

      // app1: should be converted
      const app1Content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(app1Content).toContain('module.exports =');

      // app2: should NOT be converted (type: module)
      const app2Content = tree.read('apps/app2/jest.config.ts', 'utf-8');
      expect(app2Content).toContain('export default');

      // lib1: should be converted
      const lib1Content = tree.read('libs/lib1/jest.config.ts', 'utf-8');
      expect(lib1Content).toContain('module.exports =');
      expect(lib1Content).toContain("const { readFileSync } = require('fs')");
    });
  });

  describe('other jest config extensions', () => {
    it('should not affect other jest config extensions', async () => {
      tree.write('apps/app1/jest.config.js', 'module.exports = {};');
      tree.write('apps/app1/jest.config.cjs', 'module.exports = {};');
      tree.write('apps/app1/jest.config.mjs', 'export default {};');
      tree.write('apps/app1/jest.config.cts', 'module.exports = {};');
      tree.write('apps/app1/jest.config.mts', 'export default {};');
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });

      await migration(tree);

      // All should still exist as-is
      expect(tree.read('apps/app1/jest.config.js', 'utf-8')).toBe(
        'module.exports = {};'
      );
      expect(tree.read('apps/app1/jest.config.cjs', 'utf-8')).toBe(
        'module.exports = {};'
      );
      expect(tree.read('apps/app1/jest.config.mjs', 'utf-8')).toBe(
        'export default {};'
      );
      expect(tree.read('apps/app1/jest.config.cts', 'utf-8')).toBe(
        'module.exports = {};'
      );
      expect(tree.read('apps/app1/jest.config.mts', 'utf-8')).toBe(
        'export default {};'
      );
    });
  });

  describe('complex config patterns', () => {
    it('should handle SWC config pattern with import and export', async () => {
      tree.write(
        'apps/app1/jest.config.ts',
        `import { readFileSync } from 'fs';

const swcJestConfig = JSON.parse(
  readFileSync(\`\${__dirname}/.spec.swcrc\`, 'utf-8')
);

swcJestConfig.swcrc = false;

export default {
  displayName: 'app1',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
};`
      );
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });

      await migration(tree);

      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toContain("const { readFileSync } = require('fs')");
      expect(content).toContain('module.exports =');
      expect(content).toContain('swcJestConfig.swcrc = false');
      expect(content).not.toContain('import { readFileSync }');
      expect(content).not.toContain('export default');
    });
  });

  describe('plugin registration guard', () => {
    it('should NOT run migration when @nx/jest/plugin is not registered', async () => {
      // Remove the plugin from nx.json
      const nxJson = readJson(tree, 'nx.json');
      nxJson.plugins = [];
      writeJson(tree, 'nx.json', nxJson);

      const originalContent = `export default {
  displayName: 'app1',
};`;
      tree.write('apps/app1/jest.config.ts', originalContent);
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });

      await migration(tree);

      // File should remain unchanged
      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toContain('export default');
    });

    it('should run migration when @nx/jest/plugin is registered as object', async () => {
      // Register plugin as object format
      const nxJson = readJson(tree, 'nx.json');
      nxJson.plugins = [{ plugin: '@nx/jest/plugin', options: {} }];
      writeJson(tree, 'nx.json', nxJson);

      tree.write(
        'apps/app1/jest.config.ts',
        `export default {
  displayName: 'app1',
};`
      );
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });

      await migration(tree);

      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toContain('module.exports =');
    });

    it('should NOT run migration when nx.json does not exist', async () => {
      tree.delete('nx.json');

      const originalContent = `export default {
  displayName: 'app1',
};`;
      tree.write('apps/app1/jest.config.ts', originalContent);
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });

      await migration(tree);

      // File should remain unchanged
      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toContain('export default');
    });

    it('should NOT convert files excluded from plugin via exclude pattern', async () => {
      // Register plugin with exclude pattern
      const nxJson = readJson(tree, 'nx.json');
      nxJson.plugins = [
        {
          plugin: '@nx/jest/plugin',
          exclude: ['apps/excluded/**/*'],
        },
      ];
      writeJson(tree, 'nx.json', nxJson);

      const originalContent = `export default {
  displayName: 'excluded-app',
};`;
      tree.write('apps/excluded/jest.config.ts', originalContent);
      writeJson(tree, 'apps/excluded/package.json', { type: 'commonjs' });

      // Also create a non-excluded file to ensure it still gets converted
      tree.write(
        'apps/included/jest.config.ts',
        `export default {
  displayName: 'included-app',
};`
      );
      writeJson(tree, 'apps/included/package.json', { type: 'commonjs' });

      await migration(tree);

      // Excluded file should remain unchanged
      const excludedContent = tree.read(
        'apps/excluded/jest.config.ts',
        'utf-8'
      );
      expect(excludedContent).toContain('export default');

      // Included file should be converted
      const includedContent = tree.read(
        'apps/included/jest.config.ts',
        'utf-8'
      );
      expect(includedContent).toContain('module.exports =');
    });

    it('should only convert files matching include pattern', async () => {
      // Register plugin with include pattern
      const nxJson = readJson(tree, 'nx.json');
      nxJson.plugins = [
        {
          plugin: '@nx/jest/plugin',
          include: ['libs/**/*'],
        },
      ];
      writeJson(tree, 'nx.json', nxJson);

      // Create file outside include pattern
      tree.write(
        'apps/app1/jest.config.ts',
        `export default {
  displayName: 'app1',
};`
      );
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });

      // Create file inside include pattern
      tree.write(
        'libs/lib1/jest.config.ts',
        `export default {
  displayName: 'lib1',
};`
      );
      writeJson(tree, 'libs/lib1/package.json', { type: 'commonjs' });

      await migration(tree);

      // File outside include pattern should remain unchanged
      const appContent = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(appContent).toContain('export default');

      // File inside include pattern should be converted
      const libContent = tree.read('libs/lib1/jest.config.ts', 'utf-8');
      expect(libContent).toContain('module.exports =');
    });
  });
});
