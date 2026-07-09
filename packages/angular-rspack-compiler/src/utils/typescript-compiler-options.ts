import { dirname } from 'node:path';
import * as ts from 'typescript';

/**
 * Raises `target` to ES2022, the syntax the bundling pipeline emits
 * regardless of the configured target, defaulting `useDefineForClassFields`
 * to `false` in that case to keep the assignment semantics a lower target
 * implied. Returns whether the options were adjusted so callers can surface
 * a setup warning.
 */
export function applyEs2022TargetDefaults(
  compilerOptions: ts.CompilerOptions
): boolean {
  if (
    compilerOptions.target === undefined ||
    compilerOptions.target < ts.ScriptTarget.ES2022
  ) {
    compilerOptions.target = ts.ScriptTarget.ES2022;
    compilerOptions.useDefineForClassFields ??= false;
    return true;
  }
  return false;
}

/**
 * The `jsc.transform` options for the swc rule that transpiles TypeScript
 * emitted by the Angular compilation (and raw sources), derived from the
 * project's tsconfig so the output keeps the semantics the type program
 * assumed.
 */
export interface SwcTranspilationTransform {
  legacyDecorator: boolean;
  /**
   * The revision applied for standard (TC39) decorators
   * (`legacyDecorator: false`); swc's default revision predates the
   * semantics TypeScript implements.
   */
  decoratorVersion?: '2022-03' | '2023-11';
  decoratorMetadata: boolean;
  useDefineForClassFields: boolean;
  verbatimModuleSyntax: boolean;
  /**
   * JSX lowering for `.tsx` sources, read from the tsconfig the way esbuild
   * does: the automatic runtime for 'react-jsx'/'react-jsxdev', the classic
   * transform otherwise ('preserve' included; esbuild lowers it too).
   */
  react: {
    runtime: 'automatic' | 'classic';
    development: boolean;
    pragma?: string;
    pragmaFrag?: string;
    importSource?: string;
  };
}

export function resolveSwcTranspilationTransform(
  tsconfigPath: string,
  standardDecoratorVersion: '2022-03' | '2023-11'
): SwcTranspilationTransform {
  // Read errors are reported in-band and deliberately ignored: a missing or
  // malformed tsconfig recovers to the forced defaults here, and the build
  // still fails through rspack's own resolution of the same tsconfig path.
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  const compilerOptions: ts.CompilerOptions = {
    ...ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      dirname(tsconfigPath)
    ).options,
  };

  applyEs2022TargetDefaults(compilerOptions);

  const legacyDecorator = !!compilerOptions.experimentalDecorators;

  return {
    legacyDecorator,
    ...(legacyDecorator ? {} : { decoratorVersion: standardDecoratorVersion }),
    // Design-type metadata comes from the type checker; swc emits what the
    // annotations alone provide, which is as much as a per-file transpiler
    // can honor.
    decoratorMetadata:
      legacyDecorator && !!compilerOptions.emitDecoratorMetadata,
    // With the target raised to ES2022 the forced default is false; an
    // ES2022+ tsconfig without the option gets TypeScript's default. For a
    // target-less tsconfig esbuild instead uses its own default of true,
    // contradicting the program options it forces; we follow the program.
    useDefineForClassFields: compilerOptions.useDefineForClassFields ?? true,
    verbatimModuleSyntax: !!compilerOptions.verbatimModuleSyntax,
    react: resolveJsxTransform(compilerOptions),
  };
}

// swc's factory defaults (React.createElement, React.Fragment, 'react')
// match esbuild's, so the options are only set when the tsconfig sets them.
function resolveJsxTransform(
  compilerOptions: ts.CompilerOptions
): SwcTranspilationTransform['react'] {
  const { jsx, jsxFactory, jsxFragmentFactory, jsxImportSource } =
    compilerOptions;
  return {
    runtime:
      jsx === ts.JsxEmit.ReactJSX || jsx === ts.JsxEmit.ReactJSXDev
        ? 'automatic'
        : 'classic',
    development: jsx === ts.JsxEmit.ReactJSXDev,
    ...(jsxFactory ? { pragma: jsxFactory } : {}),
    ...(jsxFragmentFactory ? { pragmaFrag: jsxFragmentFactory } : {}),
    ...(jsxImportSource ? { importSource: jsxImportSource } : {}),
  };
}
