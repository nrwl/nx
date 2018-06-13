import * as fs from 'fs';

import { WorkspaceResults } from './workspace-results';
import { serializeJson } from '../utils/fileutils';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

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
      results.success('proj');

      expect(results.getResult('proj')).toBe(true);
    });

    it('should remove results from file system', () => {
      spyOn(fs, 'writeSync');
      spyOn(fs, 'unlinkSync');
      spyOn(fs, 'existsSync').and.returnValue(true);

      results.success('proj');
      results.saveResults();

      expect(fs.writeSync).not.toHaveBeenCalled();
      expect(fs.unlinkSync).toHaveBeenCalledWith('.nx-results');
    });

    it('should print results', () => {
      results.success('proj');
      spyOn(console, 'log');

      results.printResults(false, 'Success', 'Fail');

      expect(console.log).toHaveBeenCalledWith('Success');
    });

    it('should tell warn the user that not all tests were run', () => {
      (<any>results).startedWithFailedProjects = true;
      results.success('proj');
      spyOn(console, 'warn');

      results.printResults(true, 'Success', 'Fail');

      expect(console.warn).toHaveBeenCalledWith(stripIndents`
          Warning: Only failed affected projects were run.
          You should run above command WITHOUT --only-failed
        `);
    });
  });

  describe('fail', () => {
    it('should return false when getting results', () => {
      results.fail('proj');

      expect(results.getResult('proj')).toBe(false);
    });

    it('should save results to file system', () => {
      spyOn(fs, 'writeFileSync');

      results.fail('proj');
      results.saveResults();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '.nx-results',
        serializeJson({
          command: 'test',
          results: {
            proj: false
          }
        })
      );
    });

    it('should print results', () => {
      results.fail('proj');
      spyOn(console, 'error');

      results.printResults(true, 'Success', 'Fail');

      expect(console.error).toHaveBeenCalledWith('Fail');
    });

    it('should tell warn the user that not all tests were run', () => {
      results.fail('proj');
      spyOn(console, 'log');

      results.printResults(false, 'Success', 'Fail');

      expect(console.log).toHaveBeenCalledWith(
        `You can isolate the above projects by passing --only-failed`
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

      expect(fs.readFileSync).toHaveBeenCalledWith('.nx-results', 'utf-8');
      expect(results.getResult('proj')).toBe(false);
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
