import * as fs from 'fs';

import { WorkspaceResults } from './workspace-results';
import { serializeJson } from '../utils/fileutils';
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
      spyOn(fs, 'writeSync');
      spyOn(fs, 'unlinkSync');
      spyOn(fs, 'existsSync').and.returnValue(true);

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
      spyOn(fs, 'existsSync').and.returnValue(true);
    });

    it('should read existing results', () => {
      spyOn(fs, 'readFileSync').and.returnValue(
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
      spyOn(fs, 'readFileSync').and.returnValue('invalid json');

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
      spyOn(fs, 'readFileSync').and.returnValue(
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
      spyOn(fs, 'readFileSync').and.returnValue(
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
