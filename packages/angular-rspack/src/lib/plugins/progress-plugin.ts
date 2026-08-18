/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import type { Compiler, RspackPluginInstance } from '@rspack/core';
import { Spinner } from '../utils/spinner';

// Driven via compiler hooks instead of extending @rspack/core's ProgressPlugin:
// the latter's wrapper does `progress(p, m, ...items)` and crashes when the
// native binding passes undefined for items (fixed in rspack 2.x, not 1.x).
export class ProgressPlugin implements RspackPluginInstance {
  constructor(private readonly platform: 'server' | 'browser') {}

  apply(compiler: Compiler): void {
    const platformCapitalFirst = this.platform.replace(/^\w/, (s) =>
      s.toUpperCase()
    );
    const spinner = new Spinner();
    spinner.start(
      `Generating ${this.platform} application bundles (phase: setup)...`
    );

    compiler.hooks.compile.tap('AngularRspackProgressPlugin', () => {
      if (!spinner.isSpinning) {
        spinner.start();
      }
      spinner.text = `Generating ${this.platform} application bundles...`;
    });

    compiler.hooks.invalid.tap('AngularRspackProgressPlugin', () => {
      if (!spinner.isSpinning) {
        spinner.start();
      }
      spinner.text = `Regenerating ${this.platform} application bundles...`;
    });

    compiler.hooks.done.tap('AngularRspackProgressPlugin', () => {
      if (spinner.isSpinning) {
        spinner.succeed(
          `${platformCapitalFirst} application bundle generation complete.`
        );
      }
    });
  }
}
