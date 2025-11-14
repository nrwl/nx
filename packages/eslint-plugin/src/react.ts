import type { ConfigArray } from 'typescript-eslint';
import reactBase from './flat-configs/react-base';
import reactJsx from './flat-configs/react-jsx';
import reactTmp from './flat-configs/react-tmp';
import reactTypescript from './flat-configs/react-typescript';

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
