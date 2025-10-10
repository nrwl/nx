import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { updateViteConfigForServerEntry } from './update-vite-config';

describe('updateViteConfigForServerEntry', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should transform entry and fileName properties', () => {
    const initialConfig = `
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      fileName: 'index',
    },
  },
});
`;

    tree.write('vite.config.ts', initialConfig);
    const result = updateViteConfigForServerEntry(tree, 'vite.config.ts');

    expect(result).toBe(true);

    const updatedConfig = tree.read('vite.config.ts', 'utf-8');
    expect(updatedConfig).toContain("index: 'src/index.ts'");
    expect(updatedConfig).toContain("server: 'src/server.ts'");
    expect(updatedConfig).toContain('fileName: (format, entryName) =>');
    expect(updatedConfig).toContain('`${entryName}.js`');
  });

  it('should handle double quotes in entry', () => {
    const initialConfig = `
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      fileName: "index",
    },
  },
});
`;

    tree.write('vite.config.ts', initialConfig);
    const result = updateViteConfigForServerEntry(tree, 'vite.config.ts');

    expect(result).toBe(true);

    const updatedConfig = tree.read('vite.config.ts', 'utf-8');
    expect(updatedConfig).toContain("index: 'src/index.ts'");
    expect(updatedConfig).toContain("server: 'src/server.ts'");
  });

  it('should not transform if entry is already an object', () => {
    const initialConfig = `
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: 'src/index.ts',
        server: 'src/server.ts',
      },
      fileName: 'index',
    },
  },
});
`;

    tree.write('vite.config.ts', initialConfig);
    const originalConfig = tree.read('vite.config.ts', 'utf-8');
    const result = updateViteConfigForServerEntry(tree, 'vite.config.ts');

    // Should still update fileName
    expect(result).toBe(true);

    const updatedConfig = tree.read('vite.config.ts', 'utf-8');
    // Entry should remain unchanged
    expect(updatedConfig).toContain("index: 'src/index.ts'");
    expect(updatedConfig).toContain("server: 'src/server.ts'");
    // fileName should be updated
    expect(updatedConfig).toContain('fileName: (format, entryName) =>');
  });

  it('should not transform if fileName is already a function', () => {
    const initialConfig = `
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      fileName: (format, entryName) => \`\${entryName}.js\`,
    },
  },
});
`;

    tree.write('vite.config.ts', initialConfig);
    const result = updateViteConfigForServerEntry(tree, 'vite.config.ts');

    // Should still update entry
    expect(result).toBe(true);

    const updatedConfig = tree.read('vite.config.ts', 'utf-8');
    // Entry should be updated
    expect(updatedConfig).toContain("index: 'src/index.ts'");
    expect(updatedConfig).toContain("server: 'src/server.ts'");
    // fileName should remain a function
    expect(updatedConfig).toContain('fileName: (format, entryName) =>');
  });

  it('should not transform if both are already transformed', () => {
    const initialConfig = `
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: 'src/index.ts',
        server: 'src/server.ts',
      },
      fileName: (format, entryName) => \`\${entryName}.js\`,
    },
  },
});
`;

    tree.write('vite.config.ts', initialConfig);
    const result = updateViteConfigForServerEntry(tree, 'vite.config.ts');

    expect(result).toBe(false);

    const originalConfig = initialConfig;
    const updatedConfig = tree.read('vite.config.ts', 'utf-8');
    // Should remain unchanged
    expect(updatedConfig).toBe(originalConfig);
  });

  it('should return false if file does not exist', () => {
    const result = updateViteConfigForServerEntry(
      tree,
      'non-existent-vite.config.ts'
    );

    expect(result).toBe(false);
  });

  it('should not transform if entry points to different file', () => {
    const initialConfig = `
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/main.ts',
      fileName: 'index',
    },
  },
});
`;

    tree.write('vite.config.ts', initialConfig);
    const result = updateViteConfigForServerEntry(tree, 'vite.config.ts');

    // Should still update fileName
    expect(result).toBe(true);

    const updatedConfig = tree.read('vite.config.ts', 'utf-8');
    // Entry should remain unchanged
    expect(updatedConfig).toContain("entry: 'src/main.ts'");
    // fileName should be updated
    expect(updatedConfig).toContain('fileName: (format, entryName) =>');
  });

  it('should not transform if fileName has custom value', () => {
    const initialConfig = `
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      fileName: 'custom-name',
    },
  },
});
`;

    tree.write('vite.config.ts', initialConfig);
    const result = updateViteConfigForServerEntry(tree, 'vite.config.ts');

    // Should still update entry
    expect(result).toBe(true);

    const updatedConfig = tree.read('vite.config.ts', 'utf-8');
    // Entry should be updated
    expect(updatedConfig).toContain("index: 'src/index.ts'");
    expect(updatedConfig).toContain("server: 'src/server.ts'");
    // fileName should remain unchanged
    expect(updatedConfig).toContain("fileName: 'custom-name'");
  });

  it('should handle config with no entry or fileName properties', () => {
    const initialConfig = `
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      name: 'MyLib',
    },
  },
});
`;

    tree.write('vite.config.ts', initialConfig);
    const originalConfig = tree.read('vite.config.ts', 'utf-8');
    const result = updateViteConfigForServerEntry(tree, 'vite.config.ts');

    expect(result).toBe(false);

    const updatedConfig = tree.read('vite.config.ts', 'utf-8');
    // Should remain unchanged
    expect(updatedConfig).toBe(originalConfig);
  });
});
