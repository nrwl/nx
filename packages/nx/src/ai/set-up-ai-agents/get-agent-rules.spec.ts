import { getAgentRules } from './get-agent-rules';

describe('getAgentRules', () => {
  // Claude installs its skills from the plugin marketplace rather than through
  // generateFiles, so those files never see the workspace render. The rules block below is
  // the only place nx can tell Claude how to invoke nx in *this* workspace — which makes
  // it the load-bearing half of the fix for Claude specifically.
  it.each([
    ['npm', 'npm exec nx'],
    ['yarn', 'yarn nx'],
    ['pnpm', 'pnpm nx'],
    ['bun', 'bunx nx'],
  ] as const)('tells the agent to run nx as `%s` -> `%s`', (pm, invocation) => {
    const rules = getAgentRules({ nxCloud: false, packageManager: pm });

    expect(rules).toContain(`Run nx as \`${invocation}\``);
    expect(rules).toContain(`This workspace uses ${pm}.`);
    // It should state the answer, not send the agent off to find it.
    expect(rules).not.toContain(
      "Prefix nx commands with the workspace's package manager"
    );
  });

  it('never leaves a non-pnpm workspace looking at a pnpm example', () => {
    const rules = getAgentRules({ nxCloud: false, packageManager: 'yarn' });
    expect(rules).not.toContain('pnpm');
  });

  it('falls back to describing how to find the package manager when it is unknown', () => {
    const rules = getAgentRules({ nxCloud: false });
    expect(rules).toContain(
      "Prefix nx commands with the workspace's package manager"
    );
  });
});
