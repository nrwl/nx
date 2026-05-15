import type {
  Compiler,
  Configuration,
  RspackOptionsNormalized,
} from '@rspack/core';

type RspackConfigShape = Partial<RspackOptionsNormalized | Configuration>;

/**
 * Apply rspack/react config for the compose path (e.g. `withReact`):
 * sync tweaks + push react-refresh into `config.plugins`. Plugins that
 * participate in rspack's lifecycle should call
 * `applyReactConfigSync(...)` + `applyReactHotReloadToCompiler(...)`
 * instead.
 */
export function applyReactConfig(
  options: Record<string, any> = {},
  config: RspackConfigShape = {}
): void {
  if (global.NX_GRAPH_CREATION) return;

  applyReactConfigSync(config);
  if (isDevConfig(config)) {
    const ReactRefreshPlugin = loadReactRefreshPluginClass();
    config.plugins ??= [];
    config.plugins.push(new ReactRefreshPlugin({ overlay: false }));
  }
}

export function applyReactConfigSync(config: RspackConfigShape): void {
  // enable rspack node api
  config.node = {
    __dirname: true,
    __filename: true,
  };
}

export function applyReactHotReloadToCompiler(compiler: Compiler): void {
  if (!isDevConfig(compiler.options)) return;
  const ReactRefreshPlugin = loadReactRefreshPluginClass();
  new ReactRefreshPlugin({ overlay: false }).apply(compiler);
}

function isDevConfig(config: RspackConfigShape): boolean {
  return (
    process.env.NODE_ENV === 'development' || config.mode === 'development'
  );
}

function loadReactRefreshPluginClass(): new (opts: Record<string, any>) => {
  apply(compiler: Compiler): void;
} {
  // Lazy require — runs only when actually instantiated (CLI executor
  // path; Jest never reaches this). Works on Node 22.12+ via require(esm).
  const mod = require('@rspack/plugin-react-refresh');
  return mod.default ?? mod;
}
