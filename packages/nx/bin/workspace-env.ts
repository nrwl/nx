import { performance } from 'perf_hooks';

/**
 * Loads the workspace's root `.env` files, then sends Node's fatal error
 * reports to its workspace data directory. The `.env` files load first because
 * importing `cache-directory` resolves and checks the configured directories,
 * which read `NX_*` variables those files can set.
 */
export async function loadWorkspaceEnv(workspaceDir: string): Promise<void> {
  const { loadRootEnvFiles } = await import('../src/utils/dotenv.js');
  performance.mark('loading dotenv files:start');
  loadRootEnvFiles(workspaceDir);
  performance.mark('loading dotenv files:end');
  performance.measure(
    'loading dotenv files',
    'loading dotenv files:start',
    'loading dotenv files:end'
  );

  const { workspaceDataDirectoryForWorkspace } =
    await import('../src/utils/cache-directory.js');
  process.report.reportOnFatalError = true;
  process.report.directory = workspaceDataDirectoryForWorkspace(workspaceDir);
}
