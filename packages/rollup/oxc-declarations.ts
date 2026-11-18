import { readFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import type { Plugin } from 'rollup';
import ts = require('typescript');

function diagnosticText(diagnostic: ts.Diagnostic) {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
}

/**
 * Emit declaration assets for a TypeScript library alongside its Rollup bundle.
 * Use with a JavaScript transpiler and run whole-program typechecking separately.
 * Declaration paths are relative to the tsconfig declarationDir or outDir.
 */
export function oxcDeclarations(options: { tsConfig: string }): Plugin {
  const configPath = resolve(options.tsConfig);
  const maps = new Map<
    string,
    { file: string; map: import('oxc-transform').SourceMap }
  >();
  return {
    name: 'nx-oxc-declarations',
    async buildStart() {
      maps.clear();
      this.addWatchFile(configPath);
      const config = ts.getParsedCommandLineOfConfigFile(
        configPath,
        {},
        {
          ...ts.sys,
          readFile: (path) => {
            this.addWatchFile(path);
            return ts.sys.readFile(path);
          },
          onUnRecoverableConfigFileDiagnostic: (error) =>
            this.error(diagnosticText(error)),
        }
      );
      if (!config || config.errors.length) {
        this.error(
          config?.errors.map(diagnosticText).join('\n') ||
            'Unable to read ' + configPath
        );
      }
      if (!config.options.isolatedDeclarations) {
        this.error('Enable isolatedDeclarations in ' + configPath);
      }
      const output = config.options.declarationDir ?? config.options.outDir;
      if (!output) this.error('Set declarationDir or outDir in ' + configPath);
      const { isolatedDeclaration } = await import('oxc-transform');
      for (const file of config.fileNames) {
        if (!/\.(?:[cm]?ts|tsx)$/.test(file) || /\.d\.[cm]?ts$/.test(file))
          continue;
        const dest = ts
          .getOutputFileNames(config, file, !ts.sys.useCaseSensitiveFileNames)
          .find((name) => /\.d\.[cm]?ts$/.test(name));
        if (!dest) this.error('No declaration output configured for ' + file);
        const fileName = relative(output, dest).replaceAll('\\', '/');
        if (isAbsolute(fileName) || fileName.startsWith('../'))
          this.error('Declaration outside output directory: ' + dest);
        this.addWatchFile(file);
        const result = await isolatedDeclaration(
          file,
          readFileSync(file, 'utf8'),
          {
            stripInternal: config.options.stripInternal,
            sourcemap: config.options.declarationMap,
          }
        );
        if (result.errors.length)
          this.error(
            file + '\n' + result.errors.map((e) => e.message).join('\n')
          );
        let source = result.code;
        if (result.map) {
          maps.set(fileName, { file, map: result.map });
          source += '\n//# sourceMappingURL=' + basename(dest) + '.map\n';
        }
        this.emitFile({ type: 'asset', fileName, source });
      }
    },
    generateBundle(output) {
      const outputDir = output.dir ?? dirname(output.file ?? '.');
      for (const [fileName, { file, map }] of maps) {
        const dest = resolve(outputDir, fileName);
        this.emitFile({
          type: 'asset',
          fileName: fileName + '.map',
          source: JSON.stringify({
            ...map,
            file: basename(dest),
            sources: [relative(dirname(dest), file).replaceAll('\\', '/')],
          }),
        });
      }
    },
  };
}
