/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import type { Compiler, Module, RspackPluginInstance } from '@rspack/core';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NG_RSPACK_SYMBOL_NAME, type NgRspackCompilation } from '../models';

/**
 * The subset of the esbuild `Metafile` structure consumed by `extractLicenses`.
 * Built here from the rspack chunk graph instead of an esbuild bundling step.
 */
interface LicenseMetafile {
  outputs: Record<
    string | number,
    { inputs: Record<string, { bytesInOutput: number }> }
  >;
}

/**
 * The path segment used to signify that a file is part of a package.
 */
const NODE_MODULE_SEGMENT = 'node_modules';

/**
 * String constant for the NPM recommended custom license wording.
 *
 * See: https://docs.npmjs.com/cli/v9/configuring-npm/package-json#license
 *
 * Example:
 * ```
 * {
 *   "license" : "SEE LICENSE IN <filename>"
 * }
 * ```
 */
const CUSTOM_LICENSE_TEXT = 'SEE LICENSE IN ';

/**
 * A list of commonly named license files found within packages.
 */
const LICENSE_FILES = ['LICENSE', 'LICENSE.txt', 'LICENSE.md'];

/**
 * Header text that will be added to the top of the output license extraction file.
 */
const EXTRACTION_FILE_HEADER = '';

/**
 * The package entry separator to use within the output license extraction file.
 */
const EXTRACTION_FILE_SEPARATOR = '-'.repeat(80) + '\n';

/**
 * Extracts license information for each node module package included in the output
 * files of the built code. This includes JavaScript and CSS output files. The esbuild
 * metafile generated during the bundling steps is used as the source of information
 * regarding what input files where included and where they are located. A path segment
 * of `node_modules` is used to indicate that a file belongs to a package and its license
 * should be include in the output licenses file.
 *
 * The package name and license field are extracted from the `package.json` file for the
 * package. If a license file (e.g., `LICENSE`) is present in the root of the package, it
 * will also be included in the output licenses file.
 *
 * Vendored from `@angular/build` (`src/tools/esbuild/license-extractor.ts`, identical
 * across the supported Angular majors) since it is not exposed in the package's public
 * or private API. Only the esbuild `Metafile` type import is replaced with the local
 * `LicenseMetafile` interface.
 *
 * @param metafile An esbuild metafile object.
 * @param rootDirectory The root directory of the workspace.
 * @returns A string containing the content of the output licenses file.
 */
export async function extractLicenses(
  metafile: LicenseMetafile,
  rootDirectory: string
) {
  let extractedLicenseContent = `${EXTRACTION_FILE_HEADER}\n${EXTRACTION_FILE_SEPARATOR}`;

  const seenPaths = new Set<string>();
  const seenPackages = new Set<string>();

  for (const entry of Object.values(metafile.outputs)) {
    for (const [inputPath, { bytesInOutput }] of Object.entries(entry.inputs)) {
      // Skip if not included in output
      if (bytesInOutput <= 0) {
        continue;
      }

      // Skip already processed paths
      if (seenPaths.has(inputPath)) {
        continue;
      }
      seenPaths.add(inputPath);

      // Skip non-package paths
      if (!inputPath.includes(NODE_MODULE_SEGMENT)) {
        continue;
      }

      // Extract the package name from the path
      let baseDirectory = path.join(rootDirectory, inputPath);
      let nameOrScope, nameOrFile;
      let found = false;
      while (baseDirectory !== path.dirname(baseDirectory)) {
        const segment = path.basename(baseDirectory);
        if (segment === NODE_MODULE_SEGMENT) {
          found = true;
          break;
        }

        nameOrFile = nameOrScope;
        nameOrScope = segment;
        baseDirectory = path.dirname(baseDirectory);
      }

      // Skip non-package path edge cases that are not caught in the includes check above
      if (!found || !nameOrScope) {
        continue;
      }

      const packageName = nameOrScope.startsWith('@')
        ? `${nameOrScope}/${nameOrFile}`
        : nameOrScope;
      const packageDirectory = path.join(baseDirectory, packageName);

      // Load the package's metadata to find the package's name, version, and license type
      const packageJsonPath = path.join(packageDirectory, 'package.json');
      let packageJson;
      try {
        packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8')) as {
          name: string;
          version: string;
          // The object form is deprecated and should only be present in old packages
          license?: string | { type: string };
        };
      } catch {
        // Invalid package
        continue;
      }

      // Skip already processed packages
      const packageId = `${packageName}@${packageJson.version}`;
      if (seenPackages.has(packageId)) {
        continue;
      }
      seenPackages.add(packageId);

      // Attempt to find license text inside package
      let licenseText = '';
      if (
        typeof packageJson.license === 'string' &&
        packageJson.license.toLowerCase().startsWith(CUSTOM_LICENSE_TEXT)
      ) {
        // Attempt to load the package's custom license
        let customLicensePath;
        const customLicenseFile = path.normalize(
          packageJson.license.slice(CUSTOM_LICENSE_TEXT.length + 1).trim()
        );
        if (
          customLicenseFile.startsWith('..') ||
          path.isAbsolute(customLicenseFile)
        ) {
          // Path is attempting to access files outside of the package
          // TODO: Issue warning?
        } else {
          customLicensePath = path.join(packageDirectory, customLicenseFile);
          try {
            licenseText = await readFile(customLicensePath, 'utf-8');
            break;
          } catch {}
        }
      } else {
        // Search for a license file within the root of the package
        for (const potentialLicense of LICENSE_FILES) {
          const packageLicensePath = path.join(
            packageDirectory,
            potentialLicense
          );
          try {
            licenseText = await readFile(packageLicensePath, 'utf-8');
            break;
          } catch {}
        }
      }

      // Generate the package's license entry in the output content
      extractedLicenseContent += `Package: ${packageJson.name}\n`;
      extractedLicenseContent += `License: ${JSON.stringify(
        packageJson.license,
        null,
        2
      )}\n`;
      extractedLicenseContent += `\n${licenseText}\n`;
      extractedLicenseContent += EXTRACTION_FILE_SEPARATOR;
    }
  }

  return extractedLicenseContent;
}

const PLUGIN_NAME = 'angular-extract-licenses-plugin';

/**
 * License extraction inputs collected so far, keyed by the plugin instance
 * (one per compiler) that produced them. Sharing one map across the browser
 * and server compilers makes each emit the union of both, since they write
 * the licenses file to the same output location.
 */
export type SharedLicenseInputs = Map<
  object,
  Record<string, { bytesInOutput: number }>
>;

export interface ExtractLicensesPluginOptions {
  /**
   * Asset name for the licenses file, relative to the compilation output path.
   */
  outputFilename: string;
  /**
   * The root directory of the workspace.
   */
  rootDirectory: string;
  /**
   * Inputs shared with the other compilers of the build, when it has several.
   */
  sharedInputs?: SharedLicenseInputs;
}

/**
 * Emits a licenses file for the node module packages included in the output,
 * mirroring the `@angular/build` application builder's `extractLicenses`
 * behavior and output. Feeds the chunk graph's module paths to the vendored
 * extractor in place of an esbuild metafile.
 */
export class ExtractLicensesPlugin implements RspackPluginInstance {
  private readonly sharedInputs: SharedLicenseInputs;

  constructor(private options: ExtractLicensesPluginOptions) {
    this.sharedInputs = options.sharedInputs ?? new Map();
  }

  apply(compiler: Compiler) {
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tapPromise(
        {
          name: PLUGIN_NAME,
          stage: compiler.rspack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
        },
        async () => {
          const { outputFilename, rootDirectory } = this.options;
          const inputs: Record<string, { bytesInOutput: number }> = {};
          for (const chunk of compilation.chunks) {
            for (const module of compilation.chunkGraph.getChunkModulesIterable(
              chunk
            )) {
              // Concatenated modules (production) wrap the actual source
              // modules, whose paths carry the package information.
              const innerModules = (module as Module & { modules?: Module[] })
                .modules;
              for (const m of innerModules ?? [module]) {
                const resourcePath = m.nameForCondition?.();
                if (!resourcePath) {
                  continue;
                }
                inputs[path.relative(rootDirectory, resourcePath)] = {
                  bytesInOutput: 1,
                };
              }
            }
          }

          // Packages bundled into component stylesheets never appear in the
          // chunk graph; their inputs are tracked by the Angular plugin.
          const stylesheetInputs = (
            compilation as Partial<NgRspackCompilation>
          )[NG_RSPACK_SYMBOL_NAME]?.().stylesheetMetafileInputs;
          Object.assign(inputs, stylesheetInputs);

          this.sharedInputs.set(this, inputs);
          const outputs: LicenseMetafile['outputs'] = {};
          let outputIndex = 0;
          for (const compilerInputs of this.sharedInputs.values()) {
            outputs[outputIndex++] = { inputs: compilerInputs };
          }

          const licenses = await extractLicenses({ outputs }, rootDirectory);
          compilation.emitAsset(
            outputFilename,
            new compiler.rspack.sources.RawSource(licenses)
          );
        }
      );
    });
  }
}
