import { TempFs } from '@nx/devkit/internal-testing-utils';
import { join } from 'path';
import {
  ESLINT_FLAT_CONFIG_FILENAMES,
  ESLINT_OLD_CONFIG_FILENAMES,
  findFlatConfigFile,
  findOldConfigFile,
} from './config-file';

describe('config-file', () => {
  let fs: TempFs;

  beforeEach(() => {
    fs = new TempFs('eslint-config-file');
  });

  afterEach(() => {
    fs.cleanup();
  });

  describe('findFlatConfigFile', () => {
    it.each(ESLINT_FLAT_CONFIG_FILENAMES)(
      'should find flat config file "%s" when it exists in the directory',
      (configFile) => {
        fs.createFilesSync({
          [`libs/lib1/${configFile}`]: '',
        });

        const result = findFlatConfigFile('libs/lib1', fs.tempDir);

        expect(result).toEqual(join(fs.tempDir, `libs/lib1/${configFile}`));
      }
    );

    it.each(ESLINT_FLAT_CONFIG_FILENAMES)(
      'should find flat config file "%s" when it exists in a parent directory',
      (configFile) => {
        fs.createFilesSync({
          [`libs/${configFile}`]: '',
          'libs/lib1/src/index.ts': '',
        });

        const result = findFlatConfigFile('libs/lib1', fs.tempDir);

        expect(result).toEqual(join(fs.tempDir, `libs/${configFile}`));
      }
    );

    it.each(ESLINT_FLAT_CONFIG_FILENAMES)(
      'should find flat config file "%s" when it exists at the workspace root',
      (configFile) => {
        fs.createFilesSync({
          [configFile]: '',
          'libs/lib1/src/index.ts': '',
        });

        const result = findFlatConfigFile('libs/lib1', fs.tempDir);

        expect(result).toEqual(join(fs.tempDir, configFile));
      }
    );
  });

  describe('findOldConfigFile', () => {
    it.each(ESLINT_OLD_CONFIG_FILENAMES)(
      'should find flat config file "%s" when it exists in the directory',
      (configFile) => {
        fs.createFilesSync({
          [`libs/lib1/${configFile}`]: '',
        });

        const result = findOldConfigFile('libs/lib1', fs.tempDir);

        expect(result).toEqual(join(fs.tempDir, `libs/lib1/${configFile}`));
      }
    );

    it.each(ESLINT_OLD_CONFIG_FILENAMES)(
      'should find flat config file "%s" when it exists in a parent directory',
      (configFile) => {
        fs.createFilesSync({
          [`libs/${configFile}`]: '',
          'libs/lib1/src/index.ts': '',
        });

        const result = findOldConfigFile('libs/lib1', fs.tempDir);

        expect(result).toEqual(join(fs.tempDir, `libs/${configFile}`));
      }
    );

    it.each(ESLINT_OLD_CONFIG_FILENAMES)(
      'should find flat config file "%s" when it exists at the workspace root',
      (configFile) => {
        fs.createFilesSync({
          [configFile]: '',
          'libs/lib1/src/index.ts': '',
        });

        const result = findOldConfigFile('libs/lib1', fs.tempDir);

        expect(result).toEqual(join(fs.tempDir, configFile));
      }
    );
  });
});
