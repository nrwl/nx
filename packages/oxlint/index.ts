// The graph plugin only — this is what `nx.json` names as `@nx/oxlint`.
// Generators live in `./generators`.
export {
  createDependencies,
  createNodes,
  createNodesV2,
  type OxlintPluginOptions,
} from './src/plugins/plugin.js';
