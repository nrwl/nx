import {
  resolveSwcTranspilationTransform,
  TS_EXT_REGEX,
  TSX_EXT_REGEX,
  type SwcTranspilationTransform,
} from '@nx/angular-rspack-compiler';
import type { RuleSetRule } from '@rspack/core';
import { isRspackV2 } from '../../utils/rspack-version';

/**
 * The `jsc.transform` options for the swc rule, derived from the project's
 * tsconfig with the standard decorator revision the installed rspack
 * supports.
 */
export function getSwcTranspilationTransform(
  tsConfig: string
): SwcTranspilationTransform {
  // '2023-11' matches TypeScript's standard decorator behavior, but only
  // the swc bundled with rspack v2 implements it (older versions panic).
  // The closest revision rspack v1 supports applies decorators in the older
  // spec order and drops field addInitializer callbacks.
  return resolveSwcTranspilationTransform(
    tsConfig,
    isRspackV2() ? '2023-11' : '2022-03'
  );
}

/**
 * The swc module rules transpiling the TypeScript the Angular compilation
 * emits (and raw sources). Split by extension: JSX parsing must only be
 * enabled for `.tsx` sources because it steals the `<T>` cast syntax from
 * plain TypeScript.
 */
export function getSwcTranspilationRules(
  transform: SwcTranspilationTransform
): RuleSetRule[] {
  const rule = (test: RegExp, tsx: boolean): RuleSetRule => ({
    test,
    use: [
      {
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: {
              syntax: 'typescript',
              tsx,
              // Angular's fast emit path can leave decorators in the
              // output; parse them regardless of which semantics the
              // transform applies.
              decorators: true,
            },
            // Transpile with the semantics the type program assumed.
            transform,
            target: 'es2022',
          },
        },
      },
    ],
  });
  return [rule(TS_EXT_REGEX, false), rule(TSX_EXT_REGEX, true)];
}
