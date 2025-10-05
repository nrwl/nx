import type { Compiler } from '@rspack/core';
import { applyReactConfig } from '../utils/apply-react-config';

export class NxReactRspackPlugin {
  constructor(
    private options: {
      /**
       * @deprecated SVGR support is deprecated and will be removed in Nx 23.
       * TODO(v23): Remove SVGR support
       */
      svgr?: boolean;
    } = {}
  ) {}

  apply(compiler: Compiler) {
    applyReactConfig(this.options, compiler.options);
  }
}
