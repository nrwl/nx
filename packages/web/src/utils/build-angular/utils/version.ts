/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { logging, tags } from '@angular-devkit/core';
import { SemVer, gte, satisfies } from 'semver';

export function assertCompatibleAngularVersion(projectRoot: string, logger: logging.LoggerApi) {
  let angularCliPkgJson;
  let angularPkgJson;
  let rxjsPkgJson;
  const resolveOptions = { paths: [projectRoot] };

  try {
    const angularPackagePath = require.resolve('@angular/core/package.json', resolveOptions);
    const rxjsPackagePath = require.resolve('rxjs/package.json', resolveOptions);

    angularPkgJson = require(angularPackagePath);
    rxjsPkgJson = require(rxjsPackagePath);
  } catch {
    logger.error(tags.stripIndents`
      You seem to not be depending on "@angular/core" and/or "rxjs". This is an error.
    `);

    process.exit(2);
  }

  if (!(angularPkgJson && angularPkgJson['version'] && rxjsPkgJson && rxjsPkgJson['version'])) {
    logger.error(tags.stripIndents`
      Cannot determine versions of "@angular/core" and/or "rxjs".
      This likely means your local installation is broken. Please reinstall your packages.
    `);

    process.exit(2);
  }

  try {
    const angularCliPkgPath = require.resolve('@angular/cli/package.json', resolveOptions);
    angularCliPkgJson = require(angularCliPkgPath);
    if (!(angularCliPkgJson && angularCliPkgJson['version'])) {
      throw new Error();
    }
  } catch {
    logger.error(tags.stripIndents`
      Cannot determine versions of "@angular/cli".
      This likely means your local installation is broken. Please reinstall your packages.
    `);

    process.exit(2);
  }

  if (angularCliPkgJson['version'] === '0.0.0') {
    // Internal testing version
    return;
  }

  const cliMajor = new SemVer(angularCliPkgJson['version']).major;
  // e.g. CLI 8.0 supports '>=8.0.0 <9.0.0', including pre-releases (betas, rcs, snapshots)
  // of both 8 and 9.
  const supportedAngularSemver =
    `^${cliMajor}.0.0-beta || ` + `>=${cliMajor}.0.0 <${cliMajor + 1}.0.0`;

  const angularVersion = new SemVer(angularPkgJson['version']);
  const rxjsVersion = new SemVer(rxjsPkgJson['version']);

  if (!satisfies(angularVersion, supportedAngularSemver, { includePrerelease: true })) {
    logger.error(
      tags.stripIndents`
        This version of CLI is only compatible with Angular versions ${supportedAngularSemver},
        but Angular version ${angularVersion} was found instead.

        Please visit the link below to find instructions on how to update Angular.
        https://angular-update-guide.firebaseapp.com/
      ` + '\n',
    );

    process.exit(3);
  } else if (
    gte(angularVersion, '6.0.0-rc.0') &&
    !gte(rxjsVersion, '5.6.0-forward-compat.0') &&
    !gte(rxjsVersion, '6.0.0-beta.0')
  ) {
    logger.error(
      tags.stripIndents`
        This project uses version ${rxjsVersion} of RxJs, which is not supported by Angular v6+.
        The official RxJs version that is supported is 5.6.0-forward-compat.0 and greater.

        Please visit the link below to find instructions on how to update RxJs.
        https://docs.google.com/document/d/12nlLt71VLKb-z3YaSGzUfx6mJbc34nsMXtByPUN35cg/edit#
      ` + '\n',
    );

    process.exit(3);
  } else if (gte(angularVersion, '6.0.0-rc.0') && !gte(rxjsVersion, '6.0.0-beta.0')) {
    logger.warn(
      tags.stripIndents`
        This project uses a temporary compatibility version of RxJs (${rxjsVersion}).

        Please visit the link below to find instructions on how to update RxJs.
        https://docs.google.com/document/d/12nlLt71VLKb-z3YaSGzUfx6mJbc34nsMXtByPUN35cg/edit#
      ` + '\n',
    );
  }
}
