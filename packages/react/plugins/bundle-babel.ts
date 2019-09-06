import { updateBabelOptions } from '../src/utils/babel-utils';

function getRollupBabelOptions(babelOptions: any) {
  updateBabelOptions(babelOptions);
  return babelOptions;
}

module.exports = getRollupBabelOptions;
