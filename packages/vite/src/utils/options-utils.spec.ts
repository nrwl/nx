import { getViteBuildOptions } from './options-utils';
import { ExecutorContext } from '@nx/devkit';
import { ViteBuildExecutorOptions } from '../executors/build/schema';
jest.mock('vite', () => ({}));

describe('options utils', () => {
  describe('getViteBuildOptions', () => {
    const defaultViteBuildExecutorOptions: ViteBuildExecutorOptions = {
      outputPath: 'outputPath',
    };
    const defaultExecutorContext: ExecutorContext = {
      root: 'root',
      cwd: 'cwd',
      isVerbose: false,
      projectName: 'projectName',
      projectsConfigurations: {
        version: 1,
        projects: {
          projectName: { root: 'root' },
        },
      },
    };

    it('should return reportCompressedSize === true if not specified', () => {
      const buildOptions = getViteBuildOptions(
        defaultViteBuildExecutorOptions,
        defaultExecutorContext
      );
      expect(buildOptions.reportCompressedSize).toBeTruthy();
    });

    it('should return reportCompressedSize === false if specified false', () => {
      const buildOptions = getViteBuildOptions(
        { ...defaultViteBuildExecutorOptions, reportCompressedSize: false },
        defaultExecutorContext
      );
      expect(buildOptions.reportCompressedSize).toBeFalsy();
    });

    it('should return reportCompressedSize === true if specified true', () => {
      const buildOptions = getViteBuildOptions(
        { ...defaultViteBuildExecutorOptions, reportCompressedSize: true },
        defaultExecutorContext
      );
      expect(buildOptions.reportCompressedSize).toBeTruthy();
    });
  });
});
