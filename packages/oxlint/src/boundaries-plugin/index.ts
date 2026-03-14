import enforceModuleBoundaries, {
  RULE_NAME,
} from '@nx/eslint-plugin/src/rules/enforce-module-boundaries';

// Experimental bridge: reuse Nx's existing project-graph-aware rule implementation.
const nxOxlintBoundariesPlugin: { rules: Record<string, unknown> } = {
  rules: {
    [RULE_NAME]: enforceModuleBoundaries as unknown,
  },
};

export = nxOxlintBoundariesPlugin;
