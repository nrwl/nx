import {
  resolveSwcTranspilationTransform,
  type SwcTranspilationTransform,
} from '@nx/angular-rspack-compiler';
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
