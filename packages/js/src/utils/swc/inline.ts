import { readJsonFile, writeJsonFile } from '@nx/devkit';
import type { InlineProjectGraph } from '../inline';

export function generateTmpSwcrc(
  inlineProjectGraph: InlineProjectGraph,
  swcrcPath: string
) {
  const swcrc = readJsonFile(swcrcPath);

  swcrc['exclude'] = swcrc['exclude'].concat(
    Object.values(inlineProjectGraph.externals).map(
      (external) => `${external.root}/**/.*.ts$`
    ),
    'node_modules/**/*.ts$'
  );

  const tmpSwcrcPath = `tmp${swcrcPath}`;
  writeJsonFile(tmpSwcrcPath, swcrc);

  return tmpSwcrcPath;
}
