import * as fs from 'fs';

import { WorkspaceResults } from './workspace-results';
import { serializeJson } from '../utils/fileutils';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { output } from './output';

describe('WorkspacesResults', () => {
  let results: WorkspaceResults;

  beforeEach(() => {
    results = new WorkspaceResults('test');
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
      expect(fs.unlinkSync).toHaveBeenCalledWith('dist/.nx-results');
    });
  });

  describe('fail', () => {
    it('should return false when getting results', () => {
      results.setResult('proj', false);

      expect(results.getResult('proj')).toBe(false);
    });

    it('should save results to file system', () => {
      spyOn(fs, 'writeFileSync');

      results.setResult('proj', false);
      results.saveResults();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        'dist/.nx-results',
        serializeJson({
          command: 'test',
          results: {
            proj: false
          }
        })
      );
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
            proj: false
          }
        })
      );

      results = new WorkspaceResults('test');

      expect(fs.readFileSync).toHaveBeenCalledWith('dist/.nx-results', 'utf-8');
      expect(results.getResult('proj')).toBe(false);
    });

    it('should handle a corrupted results file', () => {
      spyOn(fs, 'readFileSync').and.returnValue('invalid json');

      const runTests = () => {
        results = new WorkspaceResults('test');
      };

      expect(runTests).not.toThrow();
      expect((<any>results).startedWithFailedProjects).toBeFalsy();
    });

    it('should not read the existing results when the previous command was different', () => {
      spyOn(fs, 'readFileSync').and.returnValue(
        serializeJson({
          command: 'test',
          results: {
            proj: false
          }
        })
      );

      results = new WorkspaceResults('build');

      expect(results.getResult('proj')).toBeUndefined();
    });
  });
});
