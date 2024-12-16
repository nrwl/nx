import type { Tree } from '@nx/devkit';
import { dirname } from 'path';
import type { CompilerOptions, System } from 'typescript';
import { ensureTypescript } from './ensure-typescript';

type CompilerOptionsEnumProps = Pick<
  CompilerOptions,
  | 'importsNotUsedAsValues'
  | 'jsx'
  | 'module'
  | 'moduleDetection'
  | 'moduleResolution'
  | 'newLine'
  | 'target'
>;
const optionEnumTypeMap: {
  [key in keyof CompilerOptionsEnumProps]: keyof typeof ts;
} = {
  importsNotUsedAsValues: 'ImportsNotUsedAsValues',
  jsx: 'JsxEmit',
  module: 'ModuleKind',
  moduleDetection: 'ModuleDetectionKind',
  moduleResolution: 'ModuleResolutionKind',
  newLine: 'NewLineKind',
  target: 'ScriptTarget',
};

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

  const tsSysFromTree: System = {
    ...ts.sys,
    readFile: (path) => tree.read(path, 'utf-8'),
  };

  const parsed = ts.parseJsonConfigFileContent(
    ts.readConfigFile(tsConfigPath, tsSysFromTree.readFile).config,
    tsSysFromTree,
    dirname(tsConfigPath)
  );

  // ModuleKind: { CommonJS: 'commonjs', ... } => ModuleKind: { commonjs: 'CommonJS', ... }
  const reversedCompilerOptionsEnumValues = {
    JsxEmit: reverseEnum(ts.server.protocol.JsxEmit),
    ModuleKind: reverseEnum(ts.server.protocol.ModuleKind),
    ModuleResolutionKind: reverseEnum(ts.server.protocol.ModuleResolutionKind),
    NewLineKind: reverseEnum(ts.server.protocol.NewLineKind),
    ScriptTarget: reverseEnum(ts.server.protocol.ScriptTarget),
  };
  const matchesValue = (key: keyof CompilerOptions) => {
    return (
      parsed.options[key] ===
        ts[optionEnumTypeMap[key]][compilerOptions[key]] ||
      parsed.options[key] ===
        ts[optionEnumTypeMap[key]][
          reversedCompilerOptionsEnumValues[optionEnumTypeMap[key]][
            compilerOptions[key]
          ]
        ]
    );
  };

  let result = {};
  for (const key of Object.keys(compilerOptions)) {
    if (optionEnumTypeMap[key]) {
      if (parsed.options[key] === undefined) {
        result[key] = compilerOptions[key];
      } else if (!matchesValue(key)) {
        result[key] = compilerOptions[key];
      }
    } else if (parsed.options[key] !== compilerOptions[key]) {
      result[key] = compilerOptions[key];
    }
  }

  return result;
}

type Entries<T extends object> = { [K in keyof T]: [K, T[K]] }[keyof T];
function reverseEnum<
  EnumObj extends Record<keyof EnumObj, string>,
  Result = {
    [K in EnumObj[keyof EnumObj]]: Extract<Entries<EnumObj>, [any, K]>[0];
  }
>(enumObj: EnumObj): Result {
  return Object.keys(enumObj).reduce((acc, key) => {
    acc[enumObj[key]] = key;
    return acc;
  }, {} as Result);
}
