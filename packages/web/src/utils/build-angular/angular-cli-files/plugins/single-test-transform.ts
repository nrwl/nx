/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { logging } from '@angular-devkit/core';
import { getOptions } from 'loader-utils';
import { extname, join } from 'path';
import { loader } from 'webpack';

export interface SingleTestTransformLoaderOptions {
  files: string[]; // list of paths relative to main
  logger: logging.Logger;
}

export const SingleTestTransformLoader = require.resolve(join(__dirname, 'single-test-transform'));

/**
 * This loader transforms the default test file to only run tests
 * for some specs instead of all specs.
 * It works by replacing the known content of the auto-generated test file:
 *   const context = require.context('./', true, /\.spec\.ts$/);
 *   context.keys().map(context);
 * with:
 *   const context = { keys: () => ({ map: (_a) => { } }) };
 *   context.keys().map(context);
 * So that it does nothing.
 * Then it adds import statements for each file in the files options
 * array to import them directly, and thus run the tests there.
 */
export default function loader(this: loader.LoaderContext, source: string) {
  const options = getOptions(this) as SingleTestTransformLoaderOptions;
  const lineSeparator = process.platform === 'win32' ? '\r\n' : '\n';

  const targettedImports = options.files
    .map(path => `require('./${path.replace('.' + extname(path), '')}');`)
    .join(lineSeparator);

  // TODO: maybe a documented 'marker/comment' inside test.ts would be nicer?
  const regex = /require\.context\(.*/;

  // signal the user that expected content is not present
  if (!regex.test(source)) {
    const message = [
      `The 'include' option requires that the 'main' file for tests include the line below:`,
      `const context = require.context('./', true, /\.spec\.ts$/);`,
      `Arguments passed to require.context are not strict and can be changed`,
    ];
    options.logger.error(message.join(lineSeparator));
  }

  const mockedRequireContext = '{ keys: () => ({ map: (_a) => { } }) };' + lineSeparator;
  source = source.replace(regex, mockedRequireContext + targettedImports);

  return source;
}
