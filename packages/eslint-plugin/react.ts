import type { ConfigArray } from 'typescript-eslint';
import reactBase from './src/flat-configs/react-base';
import reactJsx from './src/flat-configs/react-jsx';
import reactTmp from './src/flat-configs/react-tmp';
import reactTypescript from './src/flat-configs/react-typescript';

const plugin = {
  configs: {
    react: reactTmp,
    'react-base': reactBase,
    'react-typescript': reactTypescript,
    'react-jsx': reactJsx,
  } as Record<string, ConfigArray>,
  rules: {},
};

// ESM
export default plugin;

// CommonJS
module.exports = plugin;
