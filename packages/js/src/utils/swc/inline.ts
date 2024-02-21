import { readJsonFile, writeJsonFile } from '@nx/devkit';
import type { InlineProjectGraph } from '../inline';

export function generateTmpSwcrc(
  inlineProjectGraph: InlineProjectGraph,
  swcrcPath: string,
  tmpSwcrcPath: string
) {
  const swcrc = readJsonFile(swcrcPath);
  let exclude: string[];
  const originExcludeConfig = swcrc['exclude'] || [];

  if (Array.isArray(originExcludeConfig)) {
    exclude = originExcludeConfig;
  } else {
    exclude = [originExcludeConfig];
  }

  swcrc['exclude'] = exclude.concat(
    Object.values(inlineProjectGraph.externals).map(
      (external) => `${external.root}/**/.*.ts$`
    ),
    'node_modules/**/*.ts$'
  );

  writeJsonFile(tmpSwcrcPath, swcrc);

  return tmpSwcrcPath;
}
