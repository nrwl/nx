import type { Compiler } from '@rspack/core';
import { applyReactConfig } from '../utils/apply-react-config';

export class NxReactRspackPlugin {
  constructor(private options: { svgr?: boolean } = {}) {}

  apply(compiler: Compiler) {
    applyReactConfig(this.options, compiler.options);
  }
}
