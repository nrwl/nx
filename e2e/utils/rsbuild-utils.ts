import { basename, dirname, join } from 'node:path';
import { updateFile } from './file-utils';

export function createRsbuildPortConfig(
  configPath: string,
  port?: number
): string {
  const configFile = 'rsbuild.port.config.ts';
  updateFile(
    join(dirname(configPath), configFile),
    `import { defineConfig, loadConfig, mergeRsbuildConfig } from '@rsbuild/core';

export default defineConfig(async ({ envMode, meta }) => {
  const { content } = await loadConfig({
    cwd: import.meta.dirname,
    path: ${JSON.stringify(basename(configPath))},
    envMode,
    meta,
  });
  return mergeRsbuildConfig(content, ${JSON.stringify({
    server: { strictPort: true, ...(port === undefined ? {} : { port }) },
  })});
});
`
  );
  return configFile;
}
