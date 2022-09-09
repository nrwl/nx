import * as browserslist from 'browserslist';
import { feature, features } from 'caniuse-lite';
import * as ts from 'typescript';

export class BuildBrowserFeatures {
  private readonly _supportedBrowsers: string[];
  private readonly _es6TargetOrLater: boolean;

  constructor(
    private projectRoot: string,
    private scriptTarget: ts.ScriptTarget
  ) {
    this._supportedBrowsers = browserslist(undefined, {
      path: this.projectRoot,
    });
    this._es6TargetOrLater = this.scriptTarget > ts.ScriptTarget.ES5;
  }

  /**
   * True, when one or more browsers requires ES5
   * support and the script target is ES2015 or greater.
   */
  isDifferentialLoadingNeeded(): boolean {
    return this._es6TargetOrLater && this.isEs5SupportNeeded();
  }

  /**
   * True, when one or more browsers requires ES5 support
   */
  isEs5SupportNeeded(): boolean {
    return !this.isFeatureSupported('es6-module');
  }

  /**
   * Safari 10.1 and iOS Safari 10.3 supports modules,
   * but does not support the `nomodule` attribute.
   * While return `true`, when support for Safari 10.1 and iOS Safari 10.3
   * is required and in differential loading is enabled.
   */
  isNoModulePolyfillNeeded(): boolean {
    if (!this.isDifferentialLoadingNeeded()) {
      return false;
    }

    const safariBrowsers = ['safari 10.1', 'ios_saf 10.3'];

    return this._supportedBrowsers.some((browser) =>
      safariBrowsers.includes(browser)
    );
  }

  /**
   * True, when a browser feature is supported partially or fully.
   */
  isFeatureSupported(featureId: string): boolean {
    // y: feature is fully available
    // n: feature is unavailable
    // a: feature is partially supported
    // x: feature is prefixed
    const criteria = ['y', 'a'];

    const data = feature(features[featureId]);

    return !this._supportedBrowsers.some((browser) => {
      const [agentId, version] = browser.split(' ');

      const browserData = data.stats[agentId];
      const featureStatus = (browserData && browserData[version]) as
        | string
        | undefined;

      // We are only interested in the first character
      // Ex: when 'a #4 #5', we only need to check for 'a'
      // as for such cases we should polyfill these features as needed
      return !featureStatus || !criteria.includes(featureStatus.charAt(0));
    });
  }
}
