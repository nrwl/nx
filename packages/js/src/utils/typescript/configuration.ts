import type { Tree } from '@nx/devkit';
import { dirname } from 'path';
import type { CompilerOptions } from 'typescript';
import { ensureTypescript } from './ensure-typescript';
import { createTreeParseConfigHost } from './ts-config';

let ts: typeof import('typescript');

/**
 * Cleans up the provided compiler options to only include the options that are
 * different or not set in the provided tsconfig file.
 */
export function getNeededCompilerOptionOverrides(
  tree: Tree,
  compilerOptions: Record<keyof CompilerOptions, any>,
  tsConfigPath: string
): Record<keyof CompilerOptions, any> {
  if (!ts) {
    ts = ensureTypescript();
  }

  const host = createTreeParseConfigHost(tree);

  const parsed = ts.parseJsonConfigFileContent(
    ts.readConfigFile(tsConfigPath, host.readFile).config,
    host,
    dirname(tsConfigPath)
  );

  const optionEnums: Record<string, Record<string, unknown>> = {
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues,
    jsx: ts.JsxEmit,
    module: ts.ModuleKind,
    moduleDetection: ts.ModuleDetectionKind,
    moduleResolution: ts.ModuleResolutionKind,
    newLine: ts.NewLineKind,
    target: ts.ScriptTarget,
  };
  // ModuleKind: { CommonJS: 'commonjs', ... } => ModuleKind: { commonjs: 'CommonJS', ... }
  const reversedOptionEnumValues: Record<string, Record<string, string>> = {
    jsx: reverseEnum(ts.server.protocol.JsxEmit),
    module: reverseEnum(ts.server.protocol.ModuleKind),
    moduleResolution: reverseEnum(ts.server.protocol.ModuleResolutionKind),
    newLine: reverseEnum(ts.server.protocol.NewLineKind),
    target: reverseEnum(ts.server.protocol.ScriptTarget),
  };
  const matchesValue = (key: string, enumObj: Record<string, unknown>) => {
    const reversed = reversedOptionEnumValues[key];
    return (
      parsed.options[key] === enumObj[compilerOptions[key]] ||
      (reversed !== undefined &&
        parsed.options[key] === enumObj[reversed[compilerOptions[key]]])
    );
  };

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(compilerOptions)) {
    const enumObj = optionEnums[key];
    if (enumObj) {
      if (parsed.options[key] === undefined) {
        result[key] = compilerOptions[key];
      } else if (!matchesValue(key, enumObj)) {
        result[key] = compilerOptions[key];
      }
    } else if (parsed.options[key] !== compilerOptions[key]) {
      result[key] = compilerOptions[key];
    }
  }

  return result;
}

function reverseEnum(enumObj: Record<string, string>): Record<string, string> {
  return Object.keys(enumObj).reduce<Record<string, string>>((acc, key) => {
    acc[enumObj[key]] = key;
    return acc;
  }, {});
}
