import * as path from 'path';
import * as fs from 'fs';
import { createHash } from 'crypto';

/** Temp tsconfig for webpack+transformers so lib sources are valid (rootDir/include). See #33337 */
export function createTsConfigForWebpack(
  workspaceRoot: string,
  originalTsConfigPath: string
): string {
  const absoluteTsConfigPath = path.isAbsolute(originalTsConfigPath)
    ? originalTsConfigPath
    : path.join(workspaceRoot, originalTsConfigPath);

  const hash = createHash('md5')
    .update(absoluteTsConfigPath)
    .digest('hex')
    .slice(0, 8);

  const tempDir = path.join(workspaceRoot, '.nx', 'webpack-tsconfigs');
  const tempTsConfigPath = path.join(tempDir, `tsconfig.webpack.${hash}.json`);

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const relativeExtends = path.relative(tempDir, absoluteTsConfigPath);
  const relativeToRoot = path.relative(tempDir, workspaceRoot);

  const tempTsConfig = {
    extends: relativeExtends,
    compilerOptions: {
      rootDir: relativeToRoot,
      composite: false,
      emitDeclarationOnly: false,
      declaration: false,
      declarationMap: false,
    },
    include: [`${relativeToRoot}/**/*.ts`, `${relativeToRoot}/**/*.tsx`],
    exclude: [`${relativeToRoot}/**/node_modules/**`],
    references: [],
  };

  fs.writeFileSync(tempTsConfigPath, JSON.stringify(tempTsConfig, null, 2));
  return tempTsConfigPath;
}
