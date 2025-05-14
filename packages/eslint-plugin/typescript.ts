import javascript from './src/flat-configs/javascript';
import typescript from './src/flat-configs/typescript';

const plugin = {
  configs: {
    javascript,
    typescript,
  },
  rules: {},
};

// ESM
export default plugin;

// CommonJS
module.exports = plugin;
