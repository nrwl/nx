import { getWorkspaceContext } from './workspace-context';

describe('getWorkspaceContext', () => {
  it('renders no workspace facts when the package manager is unknown', () => {
    // The templates guard every fact, so this makes them fall back to telling the agent
    // how to determine the package manager itself — which is the correct answer when we
    // genuinely do not know it.
    expect(getWorkspaceContext(undefined, '/root')).toEqual({ pm: null });
  });

  it.each([
    ['npm', 'npm exec nx'],
    ['yarn', 'yarn nx'],
    ['pnpm', 'pnpm nx'],
    ['bun', 'bunx nx'],
  ] as const)('states how to invoke nx under %s', (packageManager, nx) => {
    expect(getWorkspaceContext(packageManager, '/root').pm.nx).toBe(nx);
  });

  it('distinguishes invoking nx from running an arbitrary local binary', () => {
    // `exec` answers "run a local binary" and `nx` answers "run nx here". Conflating them
    // is what produces docs that prefix nx two different ways on the same page.
    const { pm } = getWorkspaceContext('npm', '/root');
    expect(pm.exec).toBe('npx');
    expect(pm.nx).toBe('npm exec nx');
  });

  it('reports workspace-protocol support', () => {
    expect(
      getWorkspaceContext('pnpm', '/root').pm.supportsWorkspaceProtocol
    ).toBe(true);
    expect(
      getWorkspaceContext('npm', '/root').pm.supportsWorkspaceProtocol
    ).toBe(false);
  });

  it('names where workspace globs live', () => {
    expect(getWorkspaceContext('pnpm', '/root').pm.workspaceGlobFile).toContain(
      'pnpm-workspace.yaml'
    );
    expect(getWorkspaceContext('npm', '/root').pm.workspaceGlobFile).toContain(
      'package.json'
    );
  });
});
