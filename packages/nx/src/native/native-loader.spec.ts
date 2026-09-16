import { createRequire } from 'module';

describe('native binding identity in unit tests', () => {
  it('shares native constructors between imports and lazy requires', async () => {
    // WorkspaceContext is required lazily, while NativeTaskHasherImpl imports
    // its binding. Passing Rust external references between separate loaded
    // libraries can crash when the receiving library frees their allocations.
    const imported = await vi.importActual<typeof import('./index')>('./index');
    const required = createRequire(import.meta.url)('./index.js');

    expect(required.WorkspaceContext).toBe(imported.WorkspaceContext);
    expect(required.TaskHasher).toBe(imported.TaskHasher);
    expect(required.HashPlanner).toBe(imported.HashPlanner);
  });
});
