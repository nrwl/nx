import type { ConformanceRule, ConformanceViolation } from '@nx/conformance';

type RuleOptions = object;

const rule: ConformanceRule<RuleOptions> = {
  name: 'ensure-owners',
  category: 'consistency',
  description: 'Ensure that all projects have owners defined via Nx Owners.',
  implementation: async (context) => {
    const violations: ConformanceViolation[] = [];

    for (const node of Object.values(context.projectGraph.nodes)) {
      const metadata = node.data.metadata;
      if (!metadata?.owners || Object.keys(metadata.owners).length === 0) {
        violations.push({
          sourceProject: node.name,
          message: `This project currently has no owners defined via Nx Owners.`,
        });
      }
    }

    return {
      severity: 'medium',
      details: {
        violations,
      },
    };
  },
};

export default rule;
