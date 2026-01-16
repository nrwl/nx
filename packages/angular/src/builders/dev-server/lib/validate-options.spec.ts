import { validateOptions } from './validate-options';
import * as angularVersionUtils from '../../../executors/utilities/angular-version-utils';

describe('validateOptions', () => {
  let getInstalledAngularVersionInfoSpy: jest.SpyInstance;

  beforeEach(() => {
    getInstalledAngularVersionInfoSpy = jest.spyOn(
      angularVersionUtils,
      'getInstalledAngularVersionInfo'
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('when Angular version is < 21', () => {
    beforeEach(() => {
      getInstalledAngularVersionInfoSpy.mockReturnValue({
        major: 19,
        version: '19.2.1',
      });
    });

    it('should not throw error when define is undefined', () => {
      expect(() => {
        validateOptions({ buildTarget: 'app:build' });
      }).not.toThrow();
    });

    it('should not throw error when define is an empty object', () => {
      expect(() => {
        validateOptions({ buildTarget: 'app:build', define: {} });
      }).not.toThrow();
    });

    it('should throw error when define has keys', () => {
      expect(() => {
        validateOptions({
          buildTarget: 'app:build',
          define: { API_URL: '"http://localhost:3000"' },
        });
      }).toThrow(
        'The "define" option is only supported in Angular >= 21.0.0. You are currently using "19.2.1".'
      );
    });

    it('should include full Angular version in error message', () => {
      getInstalledAngularVersionInfoSpy.mockReturnValue({
        major: 19,
        version: '19.0.0-next.5',
      });

      expect(() => {
        validateOptions({
          buildTarget: 'app:build',
          define: { API_URL: '"http://localhost:3000"' },
        });
      }).toThrow('You are currently using "19.0.0-next.5".');
    });
  });

  describe('when Angular version is >= 21', () => {
    beforeEach(() => {
      getInstalledAngularVersionInfoSpy.mockReturnValue({
        major: 21,
        version: '21.0.0',
      });
    });

    it('should not throw error when define is undefined', () => {
      expect(() => {
        validateOptions({ buildTarget: 'app:build' });
      }).not.toThrow();
    });

    it('should not throw error when define is an empty object', () => {
      expect(() => {
        validateOptions({ buildTarget: 'app:build', define: {} });
      }).not.toThrow();
    });

    it('should not throw error when define has keys', () => {
      expect(() => {
        validateOptions({
          buildTarget: 'app:build',
          define: { API_URL: '"http://localhost:3000"' },
        });
      }).not.toThrow();
    });
  });
});
