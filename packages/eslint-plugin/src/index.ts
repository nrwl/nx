import typescript from './configs/typescript';
import javascript from './configs/javascript';
import reactTmp from './configs/react-tmp';
import reactBase from './configs/react-base';
import reactJsx from './configs/react-jsx';
import reactTypescript from './configs/react-typescript';
import angularCode from './configs/angular';
import angularTemplate from './configs/angular-template';

import flatBase from './flat-configs/base';

import enforceModuleBoundaries, {
  RULE_NAME as enforceModuleBoundariesRuleName,
} from './rules/enforce-module-boundaries';

import nxPluginChecksRule, {
  RULE_NAME as nxPluginChecksRuleName,
} from './rules/nx-plugin-checks';

import dependencyChecks, {
  RULE_NAME as dependencyChecksRuleName,
} from './rules/dependency-checks';

// Resolve any custom rules that might exist in the current workspace
import { workspaceRules } from './resolve-workspace-rules';

const configs = {
  // eslintrc configs
  typescript,
  javascript,
  react: reactTmp,
  'react-base': reactBase,
  'react-typescript': reactTypescript,
  'react-jsx': reactJsx,
  angular: angularCode,
  'angular-template': angularTemplate,

  // flat configs
  // Note: Using getters here to avoid importing packages `angular-eslint` statically, which can lead to errors if not installed.
  'flat/base': flatBase,
  get ['flat/typescript'](): typeof import('./flat-configs/typescript').default {
    return require('./flat-configs/typescript').default;
  },
  get ['flat/javascript'](): typeof import('./flat-configs/javascript').default {
    return require('./flat-configs/javascript').default;
  },
  get ['flat/react'](): typeof import('./flat-configs/react-tmp').default {
    return require('./flat-configs/react-tmp').default;
  },
  get ['flat/react-base'](): typeof import('./flat-configs/react-base').default {
    return require('./flat-configs/react-base').default;
  },
  get ['flat/react-typescript'](): typeof import('./flat-configs/react-typescript').default {
    return require('./flat-configs/react-typescript').default;
  },
  get ['flat/react-jsx'](): typeof import('./flat-configs/react-jsx').default {
    return require('./flat-configs/react-jsx').default;
  },
  get ['flat/angular'](): typeof import('./flat-configs/angular').default {
    return require('./flat-configs/angular').default;
  },
  get ['flat/angular-template'](): typeof import('./flat-configs/angular-template').default {
    return require('./flat-configs/angular-template').default;
  },
};

const rules = {
  [enforceModuleBoundariesRuleName]: enforceModuleBoundaries,
  [nxPluginChecksRuleName]: nxPluginChecksRule,
  [dependencyChecksRuleName]: dependencyChecks,
  ...workspaceRules,
};

export default { configs, rules };
export { configs, rules };
