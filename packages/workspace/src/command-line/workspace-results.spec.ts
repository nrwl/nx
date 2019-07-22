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
      expect(fs.unlinkSync).toHaveBeenCalledWith('dist/.nx-results');
    });

    it('should print results', () => {
      const projectName = 'proj';
      results.success(projectName);
      spyOn(output, 'success');

      const successTitle = 'Success';

      results.printResults(false, successTitle, 'Fail');

      expect(output.success).toHaveBeenCalledWith({
        title: successTitle
      });
    });

    it('should warn the user that not all tests were run', () => {
      (<any>results).startedWithFailedProjects = true;

      const projectName = 'proj';
      spyOn(output, 'success');
      spyOn(output, 'warn');

      results.success(projectName);

      const successTitle = 'Success';

      results.printResults(true, successTitle, 'Fail');

      expect(output.success).toHaveBeenCalledWith({
        title: successTitle
      });

      expect(output.warn).toHaveBeenCalledWith({
        title: `Only affected projects ${output.underline(
          'which had previously failed'
        )} were run`,
        bodyLines: [
          `You should verify by running ${output.underline(
            'without'
          )} ${output.bold('--only-failed')}`
        ]
      });
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
        'dist/.nx-results',
        serializeJson({
          command: 'test',
          results: {
            proj: false
          }
        })
      );
    });

    it('should print results', () => {
      const projectName = 'proj';
      results.fail(projectName);
      spyOn(output, 'error');

      const errorTitle = 'Fail';

      results.printResults(true, 'Success', errorTitle);

      expect(output.error).toHaveBeenCalledWith({
        title: errorTitle,
        bodyLines: [
          output.colors.gray('Failed projects:'),
          '',
          `${output.colors.gray('-')} ${projectName}`
        ]
      });
    });

    it('should tell the user that they can isolate only the failed tests', () => {
      const projectName = 'proj';
      results.fail(projectName);
      spyOn(output, 'error');

      const errorTitle = 'Fail';

      results.printResults(false, 'Success', errorTitle);

      expect(output.error).toHaveBeenCalledWith({
        title: errorTitle,
        bodyLines: [
          output.colors.gray('Failed projects:'),
          '',
          `${output.colors.gray('-')} ${projectName}`,
          '',
          `${output.colors.gray(
            'You can isolate the above projects by passing:'
          )} ${output.bold('--only-failed')}`
        ]
      });
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
