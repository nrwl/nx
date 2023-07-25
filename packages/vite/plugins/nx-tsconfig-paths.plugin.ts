import { stripIndents, workspaceRoot } from '@nx/devkit';
import { existsSync } from 'node:fs';
import { relative, join, resolve } from 'node:path';
import { loadConfig, createMatchPath, MatchPath } from 'tsconfig-paths';

export function nxViteTsPaths() {
  let matchTsPathEsm: MatchPath;
  let matchTsPathFallback: MatchPath | undefined;

  return {
    name: 'nx-vite-ts-paths',
    configResolved(config: any) {
      const projectRoot = config.root;
      const projectRootFromWorkspaceRoot = relative(workspaceRoot, projectRoot);

      const foundTsConfigPath = getTsConfig(
        join(
          workspaceRoot,
          'tmp',
          projectRootFromWorkspaceRoot,
          'tsconfig.generated.json'
        )
      );
      if (!foundTsConfigPath) {
        throw new Error(stripIndents`Unable to find a tsconfig in the workspace! 
There should at least be a tsconfig.base.json or tsconfig.json in the root of the workspace ${workspaceRoot}`);
      }
      const parsed = loadConfig(foundTsConfigPath);

      logIt('first parsed tsconfig: ', parsed);
      if (parsed.resultType === 'failed') {
        throw new Error(`Failed loading tsonfig at ${foundTsConfigPath}`);
      }

      matchTsPathEsm = createMatchPath(parsed.absoluteBaseUrl, parsed.paths, [
        ['exports', '.', 'import'],
        'module',
        'main',
      ]);

      const rootLevelTsConfig = getTsConfig(
        join(workspaceRoot, 'tsconfig.base.json')
      );
      const rootLevelParsed = loadConfig(rootLevelTsConfig);
      logIt('fallback parsed tsconfig: ', rootLevelParsed);
      if (rootLevelParsed.resultType === 'success') {
        matchTsPathFallback = createMatchPath(
          rootLevelParsed.absoluteBaseUrl,
          rootLevelParsed.paths,
          ['main', 'module']
        );
      }
    },
    resolveId(source: string) {
      let resolvedFile: string;
      try {
        resolvedFile = matchTsPathEsm(source);
      } catch (e) {
        logIt('Using fallback path matching.');
        resolvedFile = matchTsPathFallback?.(source);
      }

      if (!resolvedFile) {
        logIt(`Unable to resolve ${source} with tsconfig paths`);
      }

      return resolvedFile;
    },
  };
}

function getTsConfig(preferredTsConfigPath: string): string {
  return [
    resolve(preferredTsConfigPath),
    resolve(join(workspaceRoot, 'tsconfig.base.json')),
    resolve(join(workspaceRoot, 'tsconfig.json')),
  ].find((tsPath) => {
    if (existsSync(tsPath)) {
      logIt('Found tsconfig at', tsPath);
      return tsPath;
    }
  });
}

function logIt(...msg: any[]) {
  if (process.env.NX_VERBOSE_LOGGING === 'true') {
    console.debug('[Nx Vite TsPaths]', ...msg);
  }
}
