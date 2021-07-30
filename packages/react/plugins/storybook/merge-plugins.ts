import { Plugin, RuleSetRule } from 'webpack';

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
  }, [] as Plugin[]);

export const mergePlugins = (...args: Plugin[]): Plugin[] =>
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
  }, [] as Plugin[]);
