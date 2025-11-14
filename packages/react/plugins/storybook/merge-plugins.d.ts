import {
  ResolvePluginInstance,
  RuleSetRule,
  WebpackPluginInstance,
} from 'webpack';
export declare const mergeRules: (
  ...args: RuleSetRule[]
) => (WebpackPluginInstance | RuleSetRule)[];
export declare const mergePlugins: (
  ...args: (WebpackPluginInstance | ResolvePluginInstance)[]
) => (WebpackPluginInstance | ResolvePluginInstance)[];
//# sourceMappingURL=merge-plugins.d.ts.map
