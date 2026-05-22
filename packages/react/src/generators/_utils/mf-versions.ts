// Module Federation runtime + bundler-specific deps live here. Framework
// versions (react, react-dom, @types/*, typescript) are owned by @nx/react
// (../../utils/versions) and @nx/js so each dep has a single source of truth.

// Module Federation runtime packages. Keep `runtime` on the same major as
// `enhanced` / the `vite` plugin (both pull runtime 2.4.x). A 0.x runtime in
// the consumer would mismatch the 2.x runtime baked into the providers.
export const moduleFederationEnhancedVersion = '^2.4.0';
export const moduleFederationVitePluginVersion = '^1.15.5';
export const moduleFederationRuntimeVersion = '^2.4.0';

// Vite stack.
export const viteVersion = '^8.0.13';
export const vitejsPluginReactVersion = '^6.0.2';

// Rsbuild stack.
export const rsbuildCoreVersion = '^1.4.0';
export const rsbuildPluginReactVersion = '^1.3.0';

// Rspack stack.
export const rspackCoreVersion = '^2.0.3';
export const rspackCliVersion = '^2.0.3';
// Pinned (no ^) to dodge the broken 2.0.2 publish, which ships no dist/ so
// @rspack/cli can't load it for `rspack serve`. Re-float to ^ once upstream
// republishes a fixed 2.0.3+.
export const rspackDevServerVersion = '2.0.1';
