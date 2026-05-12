import { Tree, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './convert-jest-config-to-cjs';

describe('convert-jest-config-to-cjs', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
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
      expect(content).toMatchInlineSnapshot(`
        "module.exports = {
          displayName: 'app1',
          preset: '../../jest.preset.js',
        };
        "
      `);
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
      expect(content).toMatchInlineSnapshot(`
        "module.exports = {
          displayName: 'app1',
          preset: '../../jest.preset.js',
          testEnvironment: 'node',
        };
        "
      `);
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
      expect(content).toMatchInlineSnapshot(`
        "const { readFileSync } = require('fs');

        module.exports = {
          displayName: 'app1',
        };
        "
      `);
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
      expect(content).toMatchInlineSnapshot(`
        "const path = require('path').default ?? require('path');

        module.exports = {
          displayName: 'app1',
        };
        "
      `);
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
      expect(content).toMatchInlineSnapshot(`
        "const fs = require('fs');

        module.exports = {
          displayName: 'app1',
        };
        "
      `);
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
      expect(content).toMatchInlineSnapshot(`
        "require('reflect-metadata');

        module.exports = {
          displayName: 'app1',
        };
        "
      `);
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
      expect(content).toMatchInlineSnapshot(`
        "const { readFileSync: readFile } = require('fs');

        module.exports = {
          displayName: 'app1',
        };
        "
      `);
    });
  });

  describe('type-only imports', () => {
    it('should leave `import type { X } from "mod"` untouched', async () => {
      tree.write(
        'apps/app1/jest.config.ts',
        `import type { Config } from 'jest';

const config: Config = {
  displayName: 'app1',
};

export default config;`
      );
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });

      await migration(tree);

      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "import type { Config } from 'jest';

        const config: Config = {
          displayName: 'app1',
        };

        module.exports = config;
        "
      `);
    });

    it('should leave `import type Default from "mod"` untouched', async () => {
      tree.write(
        'apps/app1/jest.config.ts',
        `import type Config from 'jest';

const config: Config = { displayName: 'app1' };

export default config;`
      );
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });

      await migration(tree);

      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "import type Config from 'jest';

        const config: Config = { displayName: 'app1' };

        module.exports = config;
        "
      `);
    });

    it('should leave `import type * as T from "mod"` untouched', async () => {
      tree.write(
        'apps/app1/jest.config.ts',
        `import type * as Jest from 'jest';

const config: Jest.Config = { displayName: 'app1' };

export default config;`
      );
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });

      await migration(tree);

      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "import type * as Jest from 'jest';

        const config: Jest.Config = { displayName: 'app1' };

        module.exports = config;
        "
      `);
    });

    it('should split inline type specifiers into a type-only import and a require for value specifiers', async () => {
      tree.write(
        'apps/app1/jest.config.ts',
        `import { type Config, readConfig } from 'some-pkg';

const config: Config = readConfig();
export default config;`
      );
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });

      await migration(tree);

      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "import type { Config } from 'some-pkg';
        const { readConfig } = require('some-pkg');

        const config: Config = readConfig();
        module.exports = config;
        "
      `);
    });

    it('should drop an inline type specifier entirely when it is the only named import', async () => {
      tree.write(
        'apps/app1/jest.config.ts',
        `import { type Config } from 'jest';

const config: Config = { displayName: 'app1' };
export default config;`
      );
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });

      await migration(tree);

      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "import type { Config } from 'jest';

        const config: Config = { displayName: 'app1' };
        module.exports = config;
        "
      `);
    });

    it('should split a default + inline type specifiers into three parts', async () => {
      tree.write(
        'apps/app1/jest.config.ts',
        `import setup, { type Config, helper } from 'some-pkg';

setup();
const config: Config = helper();
export default config;`
      );
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });

      await migration(tree);

      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "import type { Config } from 'some-pkg';
        const setup = require('some-pkg').default ?? require('some-pkg');
        const { helper } = require('some-pkg');

        setup();
        const config: Config = helper();
        module.exports = config;
        "
      `);
    });

    it('should preserve renamed inline type specifiers', async () => {
      tree.write(
        'apps/app1/jest.config.ts',
        `import { type Config as JestConfig, run } from 'some-pkg';

const config: JestConfig = run();
export default config;`
      );
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });

      await migration(tree);

      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "import type { Config as JestConfig } from 'some-pkg';
        const { run } = require('some-pkg');

        const config: JestConfig = run();
        module.exports = config;
        "
      `);
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
      expect(content).toMatchInlineSnapshot(`
        "import { readFileSync } from 'fs';

        export default {
          displayName: 'app1',
        };"
      `);
    });

    it('should NOT convert when root package.json has type: module and no project package.json', async () => {
      const originalContent = `export default {
  displayName: 'app1',
};`;
      tree.write('apps/app1/jest.config.ts', originalContent);
      writeJson(tree, 'package.json', { type: 'module' });

      await migration(tree);

      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "export default {
          displayName: 'app1',
        };"
      `);
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
      expect(content).toMatchInlineSnapshot(`
        "export default {
          displayName: 'app1',
        };"
      `);
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
      expect(content).toMatchInlineSnapshot(`
        "export default {
          rootDir: import.meta.dirname,
        };"
      `);
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
      expect(content).toMatchInlineSnapshot(`
        "const config = await import('./base-config.js');

        export default {
          ...config.default,
          displayName: 'app1',
        };"
      `);
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
      expect(content).toMatchInlineSnapshot(`
        "module.exports = async () => {
          const config = await import('./base-config.js');
          return {
            ...config.default,
            displayName: 'app1',
          };
        };
        "
      `);
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
      expect(app1Content).toMatchInlineSnapshot(`
        "module.exports = {
          displayName: 'app1',
        };
        "
      `);

      // app2: should NOT be converted (type: module)
      const app2Content = tree.read('apps/app2/jest.config.ts', 'utf-8');
      expect(app2Content).toMatchInlineSnapshot(`
        "export default {
          displayName: 'app2',
        };
        "
      `);

      // lib1: should be converted
      const lib1Content = tree.read('libs/lib1/jest.config.ts', 'utf-8');
      expect(lib1Content).toMatchInlineSnapshot(`
        "const { readFileSync } = require('fs');

        module.exports = {
          displayName: 'lib1',
        };
        "
      `);
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
      expect(content).toMatchInlineSnapshot(`
        "const { readFileSync } = require('fs');

        const swcJestConfig = JSON.parse(
          readFileSync(\`\${__dirname}/.spec.swcrc\`, 'utf-8'),
        );

        swcJestConfig.swcrc = false;

        module.exports = {
          displayName: 'app1',
          preset: '../../jest.preset.js',
          transform: {
            '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
          },
        };
        "
      `);
    });
  });

  describe('executor-based setups', () => {
    it('should convert jest.config.ts even when @nx/jest/plugin is not registered', async () => {
      // Simulate an executor-based workspace: no @nx/jest/plugin in nx.json.
      tree.write(
        'apps/app1/jest.config.ts',
        `import { readFileSync } from 'fs';

const swcJestConfig = JSON.parse(
  readFileSync(\`\${__dirname}/.swcrc\`, 'utf-8')
);

export default {
  displayName: 'app1',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
};`
      );
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });

      await migration(tree);

      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "const { readFileSync } = require('fs');

        const swcJestConfig = JSON.parse(readFileSync(\`\${__dirname}/.swcrc\`, 'utf-8'));

        module.exports = {
          displayName: 'app1',
          transform: {
            '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
          },
        };
        "
      `);
    });

    it('should convert jest.config.ts when nx.json does not exist', async () => {
      tree.delete('nx.json');

      tree.write(
        'apps/app1/jest.config.ts',
        `export default {
  displayName: 'app1',
};`
      );
      writeJson(tree, 'apps/app1/package.json', { type: 'commonjs' });

      await migration(tree);

      const content = tree.read('apps/app1/jest.config.ts', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "module.exports = {
          displayName: 'app1',
        };
        "
      `);
    });
  });
});
