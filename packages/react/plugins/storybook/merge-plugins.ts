import { RuleSetRule, WebpackPluginInstance } from 'webpack';

export const mergeRules = (...args: RuleSetRule[]) =>
  args.reduce((rules, rule) => {
    if (
      rules.some(
        (includedPlugin) =>
          includedPlugin.constructor.name === rule.constructor.name
      )
    ) {
      return rules;
    }
    return [...rules, rule];
  }, [] as WebpackPluginInstance[]);

export const mergePlugins = (
  ...args: WebpackPluginInstance[]
): WebpackPluginInstance[] =>
  args.reduce((plugins, plugin) => {
    if (
      plugins.some(
        (includedPlugin) =>
          includedPlugin.constructor.name === plugin.constructor.name
      )
    ) {
      return plugins;
    }
    return [...plugins, plugin];
  }, [] as WebpackPluginInstance[]);
