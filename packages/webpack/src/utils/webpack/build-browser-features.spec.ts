import { fs, vol } from 'memfs';
jest.mock('fs', () => fs);
import { ScriptTarget } from 'typescript';

// Disable browserslist cache so that each test resolves a new config.
process.env.BROWSERSLIST_DISABLE_CACHE = 'true';

import { BuildBrowserFeatures } from './build-browser-features';

describe('BuildBrowserFeatures', () => {
  beforeEach(async () => {
    vol.fromJSON(
      {
        '.browserslistrc': '',
      },
      '/root'
    );
  });

  describe('isDifferentialLoadingNeeded', () => {
    it('should be true for for IE 9-11 and ES2015', () => {
      fs.writeFileSync('/root/.browserslistrc', 'IE 9-11');

      const buildBrowserFeatures = new BuildBrowserFeatures(
        '/root',
        ScriptTarget.ES2015
      );
      expect(buildBrowserFeatures.isDifferentialLoadingNeeded()).toBe(true);
    });

    it('should be false for Chrome and ES2015', () => {
      fs.writeFileSync('/root/.browserslistrc', 'last 1 chrome version');

      const buildBrowserFeatures = new BuildBrowserFeatures(
        '/root',
        ScriptTarget.ES2015
      );
      expect(buildBrowserFeatures.isDifferentialLoadingNeeded()).toBe(false);
    });

    it('detects no need for differential loading for target is ES5', () => {
      fs.writeFileSync('/root/.browserslistrc', 'last 1 chrome version');

      const buildBrowserFeatures = new BuildBrowserFeatures(
        '/root',
        ScriptTarget.ES5
      );
      expect(buildBrowserFeatures.isDifferentialLoadingNeeded()).toBe(false);
    });

    it('should be false for Safari 10.1 when target is ES2015', () => {
      fs.writeFileSync('/root/.browserslistrc', 'Safari 10.1');

      const buildBrowserFeatures = new BuildBrowserFeatures(
        '/root',
        ScriptTarget.ES2015
      );
      expect(buildBrowserFeatures.isDifferentialLoadingNeeded()).toBe(false);
    });
  });

  describe('isFeatureSupported', () => {
    it('should be true for es6-module and Safari 10.1', () => {
      fs.writeFileSync('/root/.browserslistrc', 'Safari 10.1');

      const buildBrowserFeatures = new BuildBrowserFeatures(
        '/root',
        ScriptTarget.ES2015
      );
      expect(buildBrowserFeatures.isFeatureSupported('es6-module')).toBe(true);
    });

    it('should be false for es6-module and IE9', () => {
      fs.writeFileSync('/root/.browserslistrc', 'IE 9');

      const buildBrowserFeatures = new BuildBrowserFeatures(
        '/root',
        ScriptTarget.ES2015
      );
      expect(buildBrowserFeatures.isFeatureSupported('es6-module')).toBe(false);
    });

    it('should be true for es6-module and last 1 chrome version', () => {
      fs.writeFileSync('/root/.browserslistrc', 'last 1 chrome version');

      const buildBrowserFeatures = new BuildBrowserFeatures(
        '/root',
        ScriptTarget.ES2015
      );
      expect(buildBrowserFeatures.isFeatureSupported('es6-module')).toBe(true);
    });

    it('should be true for es6-module and Edge 18', () => {
      fs.writeFileSync('/root/.browserslistrc', 'Edge 18');

      const buildBrowserFeatures = new BuildBrowserFeatures(
        '/root',
        ScriptTarget.ES2015
      );
      expect(buildBrowserFeatures.isFeatureSupported('es6-module')).toBe(true);
    });
  });

  describe('isNoModulePolyfillNeeded', () => {
    it('should be false for Safari 10.1 when target is ES5', () => {
      fs.writeFileSync('/root/.browserslistrc', 'Safari 10.1');

      const buildBrowserFeatures = new BuildBrowserFeatures(
        '/root',
        ScriptTarget.ES5
      );
      expect(buildBrowserFeatures.isNoModulePolyfillNeeded()).toBe(false);
    });

    it('should be false for Safari 10.1 when target is ES2015', () => {
      fs.writeFileSync('/root/.browserslistrc', 'Safari 10.1');

      const buildBrowserFeatures = new BuildBrowserFeatures(
        '/root',
        ScriptTarget.ES2015
      );
      expect(buildBrowserFeatures.isNoModulePolyfillNeeded()).toBe(false);
    });

    it('should be true for Safari 9+ when target is ES2015', () => {
      fs.writeFileSync('/root/.browserslistrc', 'Safari >= 9');

      const buildBrowserFeatures = new BuildBrowserFeatures(
        '/root',
        ScriptTarget.ES2015
      );
      expect(buildBrowserFeatures.isNoModulePolyfillNeeded()).toBe(true);
    });

    it('should be false for Safari 9+ when target is ES5', () => {
      fs.writeFileSync('/root/.browserslistrc', 'Safari >= 9');

      const buildBrowserFeatures = new BuildBrowserFeatures(
        '/root',
        ScriptTarget.ES5
      );
      expect(buildBrowserFeatures.isNoModulePolyfillNeeded()).toBe(false);
    });

    it('should be false when not supporting Safari 10.1 target is ES2015', () => {
      fs.writeFileSync(
        '/root/.browserslistrc',
        `
            Edge 18
            IE 9
          `
      );

      const buildBrowserFeatures = new BuildBrowserFeatures(
        '/root',
        ScriptTarget.ES2015
      );
      expect(buildBrowserFeatures.isNoModulePolyfillNeeded()).toBe(false);
    });
  });
});
