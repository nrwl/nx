import type { ConfigArray } from 'typescript-eslint';
import angular from './flat-configs/angular';
import angularTemplate from './flat-configs/angular-template';

const plugin = {
  configs: {
    angular,
    'angular-template': angularTemplate,
  } as Record<string, ConfigArray>,
  rules: {},
};

// ESM
export default plugin;

// CommonJS
module.exports = plugin;
