import { join } from 'path';
import { TempFs } from '../internal-testing-utils/temp-fs';
import { handleImport } from './handle-import';

describe('handleImport', () => {
  it('should load a CJS module via require', async () => {
    const path = require.resolve('path');
    const result = await handleImport(path);
    expect(result).toBeDefined();
    expect(typeof result.join).toBe('function');
  });

  it('should fall back to import() for ES modules with top-level await', async () => {
    const fs = new TempFs('handle-import', false);
    try {
      fs.createFileSync(
        'tla.mjs',
        'await Promise.resolve();\nexport const value = 42;\n'
      );

      const result = await handleImport(join(fs.tempDir, 'tla.mjs'));

      expect(result.value).toBe(42);
    } finally {
      fs.cleanup();
    }
  });

  it('should re-throw non-ESM errors', async () => {
    await expect(
      handleImport('non-existent-module-that-does-not-exist-xyz')
    ).rejects.toThrow();
  });

  it('should re-throw errors with different error codes', async () => {
    await expect(
      handleImport('non-existent-module-that-does-not-exist-xyz')
    ).rejects.toMatchObject({
      code: 'MODULE_NOT_FOUND',
    });
  });

  describe('relativeTo parameter', () => {
    it('should resolve ./ relative paths against relativeTo directory', async () => {
      // Use relativeTo pointing to the 'path' module's directory concept
      // by resolving a known module relative to a given directory
      const result = await handleImport('./handle-import', __dirname);
      expect(result).toBeDefined();
      expect(typeof result.handleImport).toBe('function');
    });

    it('should resolve ../ parent-traversal paths against relativeTo directory', async () => {
      // __dirname is packages/nx/src/utils, so ../utils/handle-import resolves correctly
      const result = await handleImport('../utils/handle-import', __dirname);
      expect(result).toBeDefined();
      expect(typeof result.handleImport).toBe('function');
    });

    it('should not alter absolute paths even when relativeTo is provided', async () => {
      const absolutePath = require.resolve('path');
      const result = await handleImport(absolutePath, '/some/other/dir');
      expect(result).toBeDefined();
      expect(typeof result.join).toBe('function');
    });

    it('should not alter bare package names even when relativeTo is provided', async () => {
      const result = await handleImport('path', '/some/other/dir');
      expect(result).toBeDefined();
      expect(typeof result.join).toBe('function');
    });

    it('should handle .js extension with relativeTo correctly', async () => {
      const result = await handleImport('./handle-import.js', __dirname);
      expect(result).toBeDefined();
      expect(typeof result.handleImport).toBe('function');
    });
  });
});
