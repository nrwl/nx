import {
  createScriptNodes,
  type ScriptPluginOptions,
} from './create-script-nodes';

export const createNodes = createScriptNodes<ScriptPluginOptions>({
  cacheName: 'js-tsx-scripts',
  technology: 'tsx',
  claims: (shebang) => shebang.interpreter === 'tsx',
  command: (file, shebang, watch) =>
    ['tsx', ...(watch ? ['watch'] : []), ...shebang.args, file].join(' '),
});

export const createNodesV2 = createNodes;
