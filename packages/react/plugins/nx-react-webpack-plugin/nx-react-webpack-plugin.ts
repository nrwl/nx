import { Compiler } from 'webpack';
import { applyReactConfig } from './lib/apply-react-config';

export class NxReactWebpackPlugin {
  constructor(private options: { svgr?: boolean } = {}) {}

  apply(compiler: Compiler): void {
    applyReactConfig(this.options, compiler.options);
  }
}
