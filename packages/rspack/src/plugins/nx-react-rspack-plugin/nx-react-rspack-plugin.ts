import type { Compiler } from '@rspack/core';
import {
  applyReactConfigSync,
  applyReactHotReloadToCompiler,
} from '../utils/apply-react-config';

export class NxReactRspackPlugin {
  constructor(private options: Record<string, any> = {}) {}

  apply(compiler: Compiler) {
    if (global.NX_GRAPH_CREATION) return;

    applyReactConfigSync(compiler.options);
    applyReactHotReloadToCompiler(compiler);
  }
}
