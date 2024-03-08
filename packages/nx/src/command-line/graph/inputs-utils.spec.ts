import { categorizeInputs, expandInputs } from './inputs-utils';

describe('inputs-utils', () => {
  describe('categorizeInputs', () => {
    it('should categorize inputs', () => {
      expect(
        categorizeInputs(
          [
            '{workspaceRoot}/file1',
            '{projectRoot}/file2',
            'ProjectConfiguration',
            'TsConfig',
            'AllExternalDependencies',
            'lib1:file3',
            'lib2:file4',
            'external:file5',
          ],
          ['lib1', 'lib2'],
          'nx:build'
        )
      ).toEqual({
        workspaceRootInputs: ['{workspaceRoot}/file1'],
        projectRootInputs: [
          { projectName: 'nx', plan: '{projectRoot}/file2' },
          { projectName: 'lib1', plan: 'file3' },
          { projectName: 'lib2', plan: 'file4' },
        ],
        externalInputs: ['external:file5'],
        otherInputs: [
          'ProjectConfiguration',
          'TsConfig',
          'AllExternalDependencies',
        ],
      });
    });
  });

  describe('expandInputs', () => {
    it('should return empty object if workspace files are empty ', () => {
      expect(
        expandInputs(['{workspaceRoot}/**'], [], {} as any, 'nx:build')
      ).toEqual({});
    });

    it('should return files that match workspaceRoot', () => {
      expect(
        expandInputs(
          ['{workspaceRoot}/**'],
          [
            {
              file: 'apps/app/src/main.ts',
              hash: 'hash',
            },
          ],
          {} as any,
          'nx:build'
        )
      ).toEqual({
        general: { '{workspaceRoot}/**': ['apps/app/src/main.ts'] },
      });
    });

    it('should return files that match projectRoot', () => {
      expect(
        expandInputs(
          ['{projectRoot}/**/*'],
          [],
          {
            projects: [{ name: 'nx', data: { root: 'nx' } }],
            fileMap: {
              nx: [
                {
                  file: 'nx/src/main.ts',
                  hash: 'hash',
                },
              ],
            },
          } as any,
          'nx:build'
        )
      ).toEqual({ nx: { '{projectRoot}/**/*': ['nx/src/main.ts'] } });
    });

    it('should return files that match projectRoot with project name', () => {
      expect(
        expandInputs(
          ['lib1:{projectRoot}/**/*'],
          [],
          {
            projects: [{ name: 'lib1', data: { root: 'lib1' } }],
            fileMap: {
              lib1: [
                {
                  file: 'lib1/src/main.ts',
                  hash: 'hash',
                },
              ],
            },
          } as any,
          'nx:build'
        )
      ).toEqual({ lib1: { '{projectRoot}/**/*': ['lib1/src/main.ts'] } });
    });
  });
});
