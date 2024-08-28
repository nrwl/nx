import angular from './src/flat-configs/angular';
import angularTemplate from './src/flat-configs/angular-template';

const plugin = {
  configs: {
    angular,
    'angular-template': angularTemplate,
  },
  rules: {},
};

// ESM
export default plugin;

// CommonJS
module.exports = plugin;
