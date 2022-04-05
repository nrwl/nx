import typescript from './configs/typescript';
import javascript from './configs/javascript';
import reactTmp from './configs/react-tmp';
import reactBase from './configs/react-base';
import reactJsx from './configs/react-jsx';
import reactTypescript from './configs/react-typescript';
import angularCode from './configs/angular';
import angularTemplate from './configs/angular-template';

import enforceModuleBoundaries, {
  RULE_NAME as enforceModuleBoundariesRuleName,
} from './rules/enforce-module-boundaries';

import nxPluginSchemaRule, {
  RULE_NAME as nxPluginSchemaRuleName,
} from './rules/nx-plugin-schema';

// Resolve any custom rules that might exist in the current workspace
import { workspaceRules } from './resolve-workspace-rules';

module.exports = {
  configs: {
    typescript,
    javascript,
    react: reactTmp,
    'react-base': reactBase,
    'react-typescript': reactTypescript,
    'react-jsx': reactJsx,
    angular: angularCode,
    'angular-template': angularTemplate,
  },
  rules: {
    [enforceModuleBoundariesRuleName]: enforceModuleBoundaries,
    [nxPluginSchemaRuleName]: nxPluginSchemaRule,
    ...workspaceRules,
  },
};
