import {
  allowDirectNxImports,
  baseConfig,
  e2eTestOnlyIgnores,
} from '../../eslint.config.mjs';

export default [...baseConfig, e2eTestOnlyIgnores, allowDirectNxImports];
