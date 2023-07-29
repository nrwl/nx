import { stripIndents } from '@nx/devkit';
import { extname } from 'path';
import type { VersionInfo } from '../../executors/utilities/angular-version-utils';
import { getInstalledAngularVersionInfo } from '../../executors/utilities/angular-version-utils';
import type { BrowserBuilderSchema } from './schema';

export function validateOptions(options: BrowserBuilderSchema): void {
  const angularVersionInfo = getInstalledAngularVersionInfo();
  validatePolyfills(options, angularVersionInfo);
  validateStyles(options, angularVersionInfo);
}

function validatePolyfills(
  options: BrowserBuilderSchema,
  { major, version }: VersionInfo
): void {
  if (major < 15 && Array.isArray(options.polyfills)) {
    throw new Error(stripIndents`The array syntax for the "polyfills" option is supported from Angular >= 15.0.0. You are currently using "${version}".
      You can resolve this error by removing the "polyfills" option, setting it to a string value or migrating to Angular 15.0.0.`);
  }
}

function validateStyles(
  options: BrowserBuilderSchema,
  { major, version }: VersionInfo
): void {
  if (!options.styles || !options.styles.length) {
    return;
  }

  if (major < 15) {
    return;
  }

  const stylusFiles = [];
  options.styles.forEach((style) => {
    const styleFile = typeof style === 'string' ? style : style.input;
    if (extname(styleFile) === '.styl') {
      stylusFiles.push(styleFile);
    }
  });

  if (stylusFiles.length) {
    throw new Error(stripIndents`Stylus is not supported since Angular v15. You're currently using "${version}".
      You have the "styles" option with the following file(s) using the ".styl" extension: ${stylusFiles
        .map((x) => `"${x}"`)
        .join(', ')}.
      Make sure to convert them to a supported extension (".css", ".scss", ".sass", ".less").`);
  }
}
