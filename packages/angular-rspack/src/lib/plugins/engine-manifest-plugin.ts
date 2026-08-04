import type { Compiler } from '@rspack/core';

/**
 * Registers the engine manifest virtual module through the `@rspack/core`
 * copy that created the compiler. Virtual files are tracked in state scoped
 * to each `@rspack/core` copy, so an instance created from this package's
 * own copy is invisible to a compiler constructed from a different one
 * (e.g. with nested installs).
 */
export class EngineManifestPlugin {
  constructor(
    private readonly path: string,
    private readonly source: string
  ) {}

  apply(compiler: Compiler): void {
    const VirtualModulesPlugin =
      compiler.rspack.experiments?.VirtualModulesPlugin;
    if (!VirtualModulesPlugin) {
      throw new Error(
        'The "@angular/ssr" application engine wiring requires the "@rspack/core" copy running the build to support virtual modules (version 1.5.0 or greater).'
      );
    }
    new VirtualModulesPlugin({ [this.path]: this.source }).apply(compiler);
  }
}
