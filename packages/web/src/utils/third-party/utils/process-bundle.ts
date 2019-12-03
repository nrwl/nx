/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  RawSourceMap,
  SourceMapConsumer,
  SourceMapGenerator
} from 'source-map';
import { minify } from 'terser';
import { ScriptTarget, transpileModule } from 'typescript';
import { SourceMapSource } from 'webpack-sources';
import { manglingDisabled } from './mangle-options';

const cacache = require('cacache');

export interface ProcessBundleOptions {
  filename: string;
  code: string;
  map?: string;
  name: string;
  sourceMaps?: boolean;
  hiddenSourceMaps?: boolean;
  vendorSourceMaps?: boolean;
  runtime?: boolean;
  optimize?: boolean;
  optimizeOnly?: boolean;
  ignoreOriginal?: boolean;
  cacheKeys?: (string | null)[];
  integrityAlgorithm?: 'sha256' | 'sha384' | 'sha512';
  runtimeData?: ProcessBundleResult[];
}

export interface ProcessBundleResult {
  name: string;
  integrity?: string;
  original?: ProcessBundleFile;
  downlevel?: ProcessBundleFile;
}

export interface ProcessBundleFile {
  filename: string;
  size: number;
  integrity?: string;
  map?: {
    filename: string;
    size: number;
  };
}

export const enum CacheKey {
  OriginalCode = 0,
  OriginalMap = 1,
  DownlevelCode = 2,
  DownlevelMap = 3
}

let cachePath: string | undefined;

export function setup(options: { cachePath: string }): void {
  cachePath = options.cachePath;
}

async function cachePut(
  content: string,
  key: string | null,
  integrity?: string
): Promise<void> {
  if (cachePath && key) {
    await cacache.put(cachePath, key, content, {
      metadata: { integrity }
    });
  }
}

export async function process(
  options: ProcessBundleOptions
): Promise<ProcessBundleResult> {
  if (!options.cacheKeys) {
    options.cacheKeys = [];
  }

  const result: ProcessBundleResult = { name: options.name };
  if (options.integrityAlgorithm) {
    // Store unmodified code integrity value -- used for SRI value replacement
    result.integrity = generateIntegrityValue(
      options.integrityAlgorithm,
      options.code
    );
  }

  // Runtime chunk requires specialized handling
  if (options.runtime) {
    return { ...result, ...(await processRuntime(options)) };
  }

  const basePath = path.dirname(options.filename);
  const filename = path.basename(options.filename);
  const downlevelFilename = filename.replace('es2015', 'es5');
  const downlevel = !options.optimizeOnly;

  // if code size is larger than 1 MB, manually handle sourcemaps with newer source-map package.
  const codeSize = Buffer.byteLength(options.code);
  const mapSize = options.map ? Buffer.byteLength(options.map) : 0;
  const manualSourceMaps = codeSize >= 1024 * 1024 || mapSize >= 1024 * 1024;

  const sourceCode = options.code;
  const sourceMap = options.map ? JSON.parse(options.map) : undefined;

  let downlevelCode;
  let downlevelMap;
  if (downlevel) {
    // Downlevel the bundle
    const transformResult = transpileModule(sourceCode, {
      fileName: downlevelFilename,
      compilerOptions: {
        sourceMap: !!sourceMap,
        target: ScriptTarget.ES5
      }
    });

    downlevelCode = transformResult.outputText;

    if (sourceMap && transformResult.sourceMapText) {
      if (manualSourceMaps) {
        downlevelMap = await mergeSourcemaps(
          sourceMap,
          JSON.parse(transformResult.sourceMapText)
        );
      } else {
        // More accurate but significantly more costly
        const tempSource = new SourceMapSource(
          transformResult.outputText,
          downlevelFilename,
          JSON.parse(transformResult.sourceMapText),
          sourceCode,
          sourceMap
        );

        downlevelMap = tempSource.map();
      }
    }
  }

  if (options.optimize) {
    if (downlevelCode) {
      const minifyResult = terserMangle(downlevelCode, {
        filename: downlevelFilename,
        map: downlevelMap,
        compress: true
      });
      downlevelCode = minifyResult.code;
      downlevelMap = minifyResult.map;
    }

    if (!options.ignoreOriginal) {
      result.original = await mangleOriginal(options);
    }
  }

  if (downlevelCode) {
    const downlevelPath = path.join(basePath, downlevelFilename);

    let mapContent;
    if (downlevelMap) {
      if (!options.hiddenSourceMaps) {
        downlevelCode += `\n//# sourceMappingURL=${downlevelFilename}.map`;
      }

      mapContent = JSON.stringify(downlevelMap);
      await cachePut(mapContent, options.cacheKeys[CacheKey.DownlevelMap]);
      fs.writeFileSync(downlevelPath + '.map', mapContent);
    }

    result.downlevel = createFileEntry(
      downlevelFilename,
      downlevelCode,
      mapContent,
      options.integrityAlgorithm
    );

    await cachePut(
      downlevelCode,
      options.cacheKeys[CacheKey.DownlevelCode],
      result.downlevel.integrity
    );
    fs.writeFileSync(downlevelPath, downlevelCode);
  }

  // If original was not processed, add info
  if (!result.original && !options.ignoreOriginal) {
    result.original = createFileEntry(
      options.filename,
      options.code,
      options.map,
      options.integrityAlgorithm
    );
  }

  return result;
}

async function mergeSourcemaps(first: RawSourceMap, second: RawSourceMap) {
  const sourceRoot = first.sourceRoot;
  const generator = new SourceMapGenerator();

  // sourcemap package adds the sourceRoot to all position source paths if not removed
  delete first.sourceRoot;

  await SourceMapConsumer.with(first, null, originalConsumer => {
    return SourceMapConsumer.with(second, null, newConsumer => {
      newConsumer.eachMapping(mapping => {
        if (mapping.originalLine === null) {
          return;
        }
        const originalPosition = originalConsumer.originalPositionFor({
          line: mapping.originalLine,
          column: mapping.originalColumn
        });
        if (
          originalPosition.line === null ||
          originalPosition.column === null ||
          originalPosition.source === null
        ) {
          return;
        }
        generator.addMapping({
          generated: {
            line: mapping.generatedLine,
            column: mapping.generatedColumn
          },
          name: originalPosition.name || undefined,
          original: {
            line: originalPosition.line,
            column: originalPosition.column
          },
          source: originalPosition.source
        });
      });
    });
  });

  const map = generator.toJSON();
  map.file = second.file;
  map.sourceRoot = sourceRoot;

  // Put the sourceRoot back
  if (sourceRoot) {
    first.sourceRoot = sourceRoot;
  }

  return map;
}

async function mangleOriginal(
  options: ProcessBundleOptions
): Promise<ProcessBundleFile> {
  const result = terserMangle(options.code, {
    filename: path.basename(options.filename),
    map: options.map ? JSON.parse(options.map) : undefined,
    ecma: 6
  });

  let mapContent;
  if (result.map) {
    if (!options.hiddenSourceMaps) {
      result.code += `\n//# sourceMappingURL=${path.basename(
        options.filename
      )}.map`;
    }

    mapContent = JSON.stringify(result.map);

    await cachePut(
      mapContent,
      (options.cacheKeys && options.cacheKeys[CacheKey.OriginalMap]) || null
    );
    fs.writeFileSync(options.filename + '.map', mapContent);
  }

  const fileResult = createFileEntry(
    options.filename,
    result.code,
    mapContent,
    options.integrityAlgorithm
  );

  await cachePut(
    result.code,
    (options.cacheKeys && options.cacheKeys[CacheKey.OriginalCode]) || null,
    fileResult.integrity
  );
  fs.writeFileSync(options.filename, result.code);

  return fileResult;
}

function terserMangle(
  code: string,
  options: {
    filename?: string;
    map?: RawSourceMap;
    compress?: boolean;
    ecma?: 5 | 6;
  } = {}
) {
  // Note: Investigate converting the AST instead of re-parsing
  // estree -> terser is already supported; need babel -> estree/terser

  // Mangle downlevel code
  const minifyOutput = minify(code, {
    compress: options.compress || false,
    ecma: options.ecma || 5,
    mangle: !manglingDisabled,
    safari10: true,
    output: {
      ascii_only: true,
      webkit: true
    },
    sourceMap:
      !!options.map &&
      ({
        filename: options.filename,
        // terser uses an old version of the sourcemap typings
        // tslint:disable-next-line: no-any
        content: options.map as any,
        asObject: true
        // typings don't include asObject option
        // tslint:disable-next-line: no-any
      } as any)
  });

  if (minifyOutput.error) {
    throw minifyOutput.error;
  }

  // tslint:disable-next-line: no-non-null-assertion
  return {
    code: minifyOutput.code!,
    map: minifyOutput.map as unknown | RawSourceMap | undefined
  };
}

function createFileEntry(
  filename: string,
  code: string,
  map: string | undefined,
  integrityAlgorithm?: string
): ProcessBundleFile {
  return {
    filename: filename,
    size: Buffer.byteLength(code),
    integrity:
      integrityAlgorithm && generateIntegrityValue(integrityAlgorithm, code),
    map: !map
      ? undefined
      : {
          filename: filename + '.map',
          size: Buffer.byteLength(map)
        }
  };
}

function generateIntegrityValue(hashAlgorithm: string, code: string) {
  return (
    hashAlgorithm +
    '-' +
    createHash(hashAlgorithm)
      .update(code)
      .digest('base64')
  );
}

// The webpack runtime chunk is already ES5.
// However, two variants are still needed due to lazy routing and SRI differences
// NOTE: This should eventually be a babel plugin
async function processRuntime(
  options: ProcessBundleOptions
): Promise<Partial<ProcessBundleResult>> {
  let originalCode = options.code;
  let downlevelCode = options.code;

  // Replace integrity hashes with updated values
  if (options.integrityAlgorithm && options.runtimeData) {
    for (const data of options.runtimeData) {
      if (!data.integrity) {
        continue;
      }

      if (data.original && data.original.integrity) {
        originalCode = originalCode.replace(
          data.integrity,
          data.original.integrity
        );
      }
      if (data.downlevel && data.downlevel.integrity) {
        downlevelCode = downlevelCode.replace(
          data.integrity,
          data.downlevel.integrity
        );
      }
    }
  }

  // Adjust lazy loaded scripts to point to the proper variant
  // Extra spacing is intentional to align source line positions
  downlevelCode = downlevelCode.replace('"-es2015.', '   "-es5.');

  const downlevelFilePath = options.filename.replace('es2015', 'es5');
  let downlevelMap;
  let result;
  if (options.optimize) {
    const minifiyResults = terserMangle(downlevelCode, {
      filename: path.basename(downlevelFilePath),
      map: options.map === undefined ? undefined : JSON.parse(options.map)
    });
    downlevelCode = minifiyResults.code;
    downlevelMap = JSON.stringify(minifiyResults.map);

    result = {
      original: await mangleOriginal({ ...options, code: originalCode }),
      downlevel: createFileEntry(
        downlevelFilePath,
        downlevelCode,
        downlevelMap,
        options.integrityAlgorithm
      )
    };
  } else {
    if (options.map) {
      const rawMap = JSON.parse(options.map) as RawSourceMap;
      rawMap.file = path.basename(downlevelFilePath);
      downlevelMap = JSON.stringify(rawMap);
    }

    result = {
      original: createFileEntry(
        options.filename,
        originalCode,
        options.map,
        options.integrityAlgorithm
      ),
      downlevel: createFileEntry(
        downlevelFilePath,
        downlevelCode,
        downlevelMap,
        options.integrityAlgorithm
      )
    };
  }

  if (downlevelMap) {
    await cachePut(
      downlevelMap,
      (options.cacheKeys && options.cacheKeys[CacheKey.DownlevelMap]) || null
    );
    fs.writeFileSync(downlevelFilePath + '.map', downlevelMap);
    downlevelCode += `\n//# sourceMappingURL=${path.basename(
      downlevelFilePath
    )}.map`;
  }
  await cachePut(
    downlevelCode,
    (options.cacheKeys && options.cacheKeys[CacheKey.DownlevelCode]) || null
  );
  fs.writeFileSync(downlevelFilePath, downlevelCode);

  return result;
}
