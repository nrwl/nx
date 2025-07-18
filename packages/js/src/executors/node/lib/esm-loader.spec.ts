import { resolve } from './esm-loader';
import { pathToFileURL } from 'node:url';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { setupWorkspaceContext } from 'nx/src/utils/workspace-context';

describe('ESM Loader', () => {
  let tempFs: TempFs;
  let cwd: string;
  const mockContext = {};
  const mockNextResolve = jest.fn();

  beforeEach(() => {
    cwd = process.cwd();
    tempFs = new TempFs('esm-loader');
    process.chdir(tempFs.tempDir);
    setupWorkspaceContext(tempFs.tempDir);
    jest.clearAllMocks();
    delete process.env.NX_MAPPINGS;
  });

  afterEach(() => {
    tempFs.cleanup();
    process.chdir(cwd);
    jest.resetModules();
  });

  describe('resolve', () => {
    it('should resolve workspace library mappings', async () => {
      const distPath = `${tempFs.tempDir}/dist/libs/lib1`;
      await tempFs.createFiles({
        'dist/libs/lib1/index.js': 'export default {};',
        'dist/libs/lib2/index.js': 'export default {};',
      });

      process.env.NX_MAPPINGS = JSON.stringify({
        '@myorg/lib1': distPath,
        '@myorg/lib2': `${tempFs.tempDir}/dist/libs/lib2`,
      });

      await resolve('@myorg/lib1', mockContext, mockNextResolve);

      expect(mockNextResolve).toHaveBeenCalledWith(
        pathToFileURL(`${distPath}/index.js`).href,
        mockContext
      );
    });

    it('should resolve workspace library subpaths', async () => {
      const distPath = `${tempFs.tempDir}/dist/libs/lib1`;
      await tempFs.createFiles({
        'dist/libs/lib1/utils/helper.js': 'export default {};',
      });

      process.env.NX_MAPPINGS = JSON.stringify({
        '@myorg/lib1': distPath,
      });

      await resolve('@myorg/lib1/utils/helper', mockContext, mockNextResolve);

      expect(mockNextResolve).toHaveBeenCalledWith(
        pathToFileURL(`${distPath}/utils/helper.js`).href,
        mockContext
      );
    });

    it('should try index.js when directory exists', async () => {
      const distPath = `${tempFs.tempDir}/dist/libs/lib1`;
      await tempFs.createFiles({
        'dist/libs/lib1/utils/index.js': 'export default {};',
      });

      process.env.NX_MAPPINGS = JSON.stringify({
        '@myorg/lib1': distPath,
      });

      await resolve('@myorg/lib1/utils', mockContext, mockNextResolve);

      expect(mockNextResolve).toHaveBeenCalledWith(
        pathToFileURL(`${distPath}/utils/index.js`).href,
        mockContext
      );
    });

    it('should try .js extension when file has no extension', async () => {
      const distPath = `${tempFs.tempDir}/dist/libs/lib1`;
      await tempFs.createFiles({
        'dist/libs/lib1/helper.js': 'export default {};',
      });

      process.env.NX_MAPPINGS = JSON.stringify({
        '@myorg/lib1': distPath,
      });

      await resolve('@myorg/lib1/helper', mockContext, mockNextResolve);

      expect(mockNextResolve).toHaveBeenCalledWith(
        pathToFileURL(`${distPath}/helper.js`).href,
        mockContext
      );
    });

    it('should try .mjs extension when other resolutions fail', async () => {
      const distPath = `${tempFs.tempDir}/dist/libs/lib1`;
      await tempFs.createFiles({
        'dist/libs/lib1/helper.mjs': 'export default {};',
      });

      process.env.NX_MAPPINGS = JSON.stringify({
        '@myorg/lib1': distPath,
      });

      await resolve('@myorg/lib1/helper', mockContext, mockNextResolve);

      expect(mockNextResolve).toHaveBeenCalledWith(
        pathToFileURL(`${distPath}/helper.mjs`).href,
        mockContext
      );
    });

    it('should fall back to default resolution when mapping not found', async () => {
      const distPath = `${tempFs.tempDir}/dist/libs/lib1`;

      process.env.NX_MAPPINGS = JSON.stringify({
        '@myorg/lib1': distPath,
      });

      await resolve('express', mockContext, mockNextResolve);

      expect(mockNextResolve).toHaveBeenCalledWith('express', mockContext);
    });

    it('should fall back to default resolution when no file found', async () => {
      const distPath = `${tempFs.tempDir}/dist/libs/lib1`;

      process.env.NX_MAPPINGS = JSON.stringify({
        '@myorg/lib1': distPath,
      });

      await resolve('@myorg/lib1/nonexistent', mockContext, mockNextResolve);

      expect(mockNextResolve).toHaveBeenCalledWith(
        '@myorg/lib1/nonexistent',
        mockContext
      );
    });

    it('should handle empty mappings', async () => {
      process.env.NX_MAPPINGS = '{}';

      await resolve('@myorg/lib1', mockContext, mockNextResolve);

      expect(mockNextResolve).toHaveBeenCalledWith('@myorg/lib1', mockContext);
    });

    it('should handle missing NX_MAPPINGS env var', async () => {
      await resolve('@myorg/lib1', mockContext, mockNextResolve);

      expect(mockNextResolve).toHaveBeenCalledWith('@myorg/lib1', mockContext);
    });
  });
});
