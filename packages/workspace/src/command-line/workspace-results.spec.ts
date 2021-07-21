import * as fs from 'fs';

import { WorkspaceResults } from './workspace-results';
import { serializeJson } from '../utilities/fileutils';
import { ProjectType } from '../core/project-graph';

describe('WorkspacesResults', () => {
  let results: WorkspaceResults;

  beforeEach(() => {
    results = new WorkspaceResults('test', {
      proj: {
        name: 'proj',
        type: ProjectType.app,
        data: {
          files: [],
        },
      },
    });
  });

  it('should be instantiable', () => {
    expect(results).toBeTruthy();
  });

  it('should default with no failed projects', () => {
    expect(results.hasFailure).toBe(false);
  });

  describe('success', () => {
    it('should return true when getting results', () => {
      results.setResult('proj', true);

      expect(results.getResult('proj')).toBe(true);
    });

    it('should remove results from file system', () => {
      jest.spyOn(fs, 'writeSync');
      jest.spyOn(fs, 'unlinkSync').mockImplementationOnce(() => {});
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);

      results.setResult('proj', true);
      results.saveResults();

      expect(fs.writeSync).not.toHaveBeenCalled();
      expect(fs.unlinkSync).toHaveBeenCalled();
    });
  });

  describe('fail', () => {
    it('should return false when getting results', () => {
      results.setResult('proj', false);

      expect(results.getResult('proj')).toBe(false);
    });
  });

  describe('when results already exist', () => {
    beforeEach(() => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    });

    it('should read existing results', () => {
      jest.spyOn(fs, 'readFileSync').mockReturnValue(
        serializeJson({
          command: 'test',
          results: {
            proj: false,
          },
        })
      );

      results = new WorkspaceResults('test', {
        proj: {
          name: 'proj',
          type: ProjectType.app,
          data: {
            files: [],
          },
        },
      });

      expect(results.getResult('proj')).toBe(false);
    });

    it('should handle a corrupted results file', () => {
      jest.spyOn(fs, 'readFileSync').mockReturnValue('invalid json');

      const runTests = () => {
        results = new WorkspaceResults('test', {
          proj: {
            name: 'proj',
            type: ProjectType.app,
            data: {
              files: [],
            },
          },
        });
      };

      expect(runTests).not.toThrow();
      expect((<any>results).startedWithFailedProjects).toBeFalsy();
    });

    it('should not read the existing results when the previous command was different', () => {
      jest.spyOn(fs, 'readFileSync').mockReturnValue(
        serializeJson({
          command: 'test',
          results: {
            proj: false,
          },
        })
      );

      results = new WorkspaceResults('build', {
        proj: {
          name: 'proj',
          type: ProjectType.app,
          data: {
            files: [],
          },
        },
      });

      expect(results.getResult('proj')).toBeUndefined();
    });

    it('should invalidate existing results when the project is not run', () => {
      jest.spyOn(fs, 'readFileSync').mockReturnValue(
        serializeJson({
          command: 'test',
          results: {
            proj: true,
            proj2: false,
          },
        })
      );

      results = new WorkspaceResults('build', {
        proj: {
          name: 'proj',
          type: ProjectType.app,
          data: {
            files: [],
          },
        },
      });

      expect(results.hasFailure).toEqual(false);
    });
  });
});
