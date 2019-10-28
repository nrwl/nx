/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */


import { TestProjectHost } from '@angular-devkit/architect/testing';
import { getSystemPath, join } from '@angular-devkit/core';
import { ScriptTarget } from 'typescript';
import { BuildBrowserFeatures } from './build-browser-features';

const devkitRoot = (global as any)._DevKitRoot; // tslint:disable-line:no-any
const workspaceRoot = join(
  devkitRoot,
  'tests/angular_devkit/build_angular/hello-world-app/');

const host = new TestProjectHost(workspaceRoot);

describe('BuildBrowserFeatures', () => {
  let workspaceRootSysPath = '';
  beforeEach(async () => {
    await host.initialize().toPromise();
    workspaceRootSysPath = getSystemPath(host.root());
  });

  afterEach(async () => host.restore().toPromise());

  describe('isDifferentialLoadingNeeded', () => {
    it('should be true for for IE 9-11 and ES2015', () => {
      host.writeMultipleFiles({
        'browserslist': 'IE 9-11',
      });

      const buildBrowserFeatures = new BuildBrowserFeatures(
        workspaceRootSysPath,
        ScriptTarget.ES2015,
      );
      expect(buildBrowserFeatures.isDifferentialLoadingNeeded()).toBe(true);
    });

    it('should be false for Chrome and ES2015', () => {
      host.writeMultipleFiles({
        'browserslist': 'last 1 chrome version',
      });

      const buildBrowserFeatures = new BuildBrowserFeatures(
        workspaceRootSysPath,
        ScriptTarget.ES2015,
      );
      expect(buildBrowserFeatures.isDifferentialLoadingNeeded()).toBe(false);
    });

    it('detects no need for differential loading for target is ES5', () => {
      host.writeMultipleFiles({
        'browserslist': 'last 1 chrome version',
      });

      const buildBrowserFeatures = new BuildBrowserFeatures(
        workspaceRootSysPath,
        ScriptTarget.ES5,
      );
      expect(buildBrowserFeatures.isDifferentialLoadingNeeded()).toBe(false);
    });

    it('should be false for Safari 10.1 when target is ES2015', () => {
      host.writeMultipleFiles({
        'browserslist': 'Safari 10.1',
      });

      const buildBrowserFeatures = new BuildBrowserFeatures(
        workspaceRootSysPath,
        ScriptTarget.ES2015,
      );
      expect(buildBrowserFeatures.isDifferentialLoadingNeeded()).toBe(false);
    });
  });

  describe('isFeatureSupported', () => {
    it('should be true for es6-module and Safari 10.1', () => {
      host.writeMultipleFiles({
        'browserslist': 'Safari 10.1',
      });

      const buildBrowserFeatures = new BuildBrowserFeatures(
        workspaceRootSysPath,
        ScriptTarget.ES2015,
      );
      expect(buildBrowserFeatures.isFeatureSupported('es6-module')).toBe(true);
    });

    it('should be false for es6-module and IE9', () => {
      host.writeMultipleFiles({
        'browserslist': 'IE 9',
      });

      const buildBrowserFeatures = new BuildBrowserFeatures(
        workspaceRootSysPath,
        ScriptTarget.ES2015,
      );
      expect(buildBrowserFeatures.isFeatureSupported('es6-module')).toBe(false);
    });

    it('should be true for es6-module and last 1 chrome version', () => {
      host.writeMultipleFiles({
        'browserslist': 'last 1 chrome version',
      });

      const buildBrowserFeatures = new BuildBrowserFeatures(
        workspaceRootSysPath,
        ScriptTarget.ES2015,
      );
      expect(buildBrowserFeatures.isFeatureSupported('es6-module')).toBe(true);
    });

    it('should be true for es6-module and Edge 18', () => {
      host.writeMultipleFiles({
        'browserslist': 'Edge 18',
      });

      const buildBrowserFeatures = new BuildBrowserFeatures(
        workspaceRootSysPath,
        ScriptTarget.ES2015,
      );
      expect(buildBrowserFeatures.isFeatureSupported('es6-module')).toBe(true);
    });
  });

  describe('isNoModulePolyfillNeeded', () => {
    it('should be false for Safari 10.1 when target is ES5', () => {
      host.writeMultipleFiles({
        'browserslist': 'Safari 10.1',
      });

      const buildBrowserFeatures = new BuildBrowserFeatures(
        workspaceRootSysPath,
        ScriptTarget.ES5,
      );
      expect(buildBrowserFeatures.isNoModulePolyfillNeeded()).toBe(false);
    });

    it('should be false for Safari 10.1 when target is ES2015', () => {
      host.writeMultipleFiles({
        'browserslist': 'Safari 10.1',
      });

      const buildBrowserFeatures = new BuildBrowserFeatures(
        workspaceRootSysPath,
        ScriptTarget.ES2015,
      );
      expect(buildBrowserFeatures.isNoModulePolyfillNeeded()).toBe(false);
    });

    it('should be true for Safari 9+ when target is ES2015', () => {
      host.writeMultipleFiles({
        'browserslist': 'Safari >= 9',
      });

      const buildBrowserFeatures = new BuildBrowserFeatures(
        workspaceRootSysPath,
        ScriptTarget.ES2015,
      );
      expect(buildBrowserFeatures.isNoModulePolyfillNeeded()).toBe(true);
    });

    it('should be false for Safari 9+ when target is ES5', () => {
      host.writeMultipleFiles({
        'browserslist': 'Safari >= 9',
      });

      const buildBrowserFeatures = new BuildBrowserFeatures(
        workspaceRootSysPath,
        ScriptTarget.ES5,
      );
      expect(buildBrowserFeatures.isNoModulePolyfillNeeded()).toBe(false);
    });

    it('should be false when not supporting Safari 10.1 target is ES2015', () => {
      host.writeMultipleFiles({
        'browserslist': `
          Edge 18
          IE 9
        `,
      });

      const buildBrowserFeatures = new BuildBrowserFeatures(
        workspaceRootSysPath,
        ScriptTarget.ES2015,
      );
      expect(buildBrowserFeatures.isNoModulePolyfillNeeded()).toBe(false);
    });
  });
});
