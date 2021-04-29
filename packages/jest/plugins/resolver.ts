import { appRootPath } from '@nrwl/workspace/src/utilities/app-root';
import { getTmpProjectRoot } from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { readJsonFile } from '@nrwl/workspace/src/utilities/fileutils';
import { existsSync, statSync } from 'fs';
import defaultResolver from 'jest-resolve/build/defaultResolver';
import { dirname, extname, join, relative } from 'path';

interface ResolveOptions {
  rootDir: string;
  basedir: string;
  paths: string[];
  moduleDirectory: string[];
  browser: boolean;
  extensions: string[];
  defaultResolver: typeof defaultResolver;
}

let compilerSetup;
let ts;

module.exports = function (path: string, options: ResolveOptions) {
  const ext = extname(path);
  if (
    ext === '.css' ||
    ext === '.scss' ||
    ext === '.sass' ||
    ext === '.less' ||
    ext === '.styl'
  ) {
    return require.resolve('identity-obj-proxy');
  }
  // Try to use the defaultResolver
  try {
    return defaultResolver(path, options);
  } catch (e) {
    if (
      path === 'jest-sequencer-@jest/test-sequencer' ||
      path === '@jest/test-sequencer'
    ) {
      return;
    }

    // Try to find it in the built deps
    ts = ts || require('typescript');
    compilerSetup =
      compilerSetup || getCompilerSetup(options.rootDir, appRootPath);
    const { compilerOptions, host } = compilerSetup;
    const resolved = tryResolveModuleFromBuiltDeps(
      path,
      compilerOptions.paths,
      appRootPath
    );
    if (resolved) {
      return resolved;
    }

    // Fallback to using typescript
    return ts.resolveModuleName(path, options.basedir, compilerOptions, host)
      .resolvedModule.resolvedFileName;
  }
};

function getCompilerSetup(rootDir: string, workspaceRoot: string) {
  const projectRoot = relative(workspaceRoot, rootDir);
  const tmpDir = getTmpProjectRoot(workspaceRoot, projectRoot);
  function findTsConfigFile(dir: string, file: string) {
    return ts.findConfigFile(dir, ts.sys.fileExists, file);
  }
  const tsConfigPath =
    findTsConfigFile(tmpDir, 'tsconfig.spec.generated.json') ||
    findTsConfigFile(tmpDir, 'tsconfig.test.generated.json') ||
    findTsConfigFile(tmpDir, 'tsconfig.jest.generated.json') ||
    findTsConfigFile(rootDir, 'tsconfig.spec.json') ||
    findTsConfigFile(rootDir, 'tsconfig.test.json') ||
    findTsConfigFile(rootDir, 'tsconfig.jest.json');

  if (!tsConfigPath) {
    console.error(
      `Cannot locate a tsconfig.spec.json. Please create one at ${rootDir}/tsconfig.spec.json`
    );
  }

  const readResult = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
  const config = ts.parseJsonConfigFileContent(
    readResult.config,
    ts.sys,
    dirname(tsConfigPath)
  );
  const compilerOptions = config.options;
  const host = ts.createCompilerHost(compilerOptions, true);
  return { compilerOptions, host };
}

function getPathsForModule(
  moduleName: string,
  pathMappings: { [key: string]: string[] }
): string[] {
  const matchedPattern = ts.matchPatternOrExact(
    ts.getOwnKeys(pathMappings),
    moduleName
  );
  if (!matchedPattern) {
    return [];
  }
  const matchedPatternText = ts.isString(matchedPattern)
    ? matchedPattern
    : ts.patternText(matchedPattern);
  const matchedStar = ts.isString(matchedPattern)
    ? undefined
    : ts.matchedText(matchedPattern, moduleName);

  if (matchedStar) {
    return pathMappings[matchedPatternText].map((path) =>
      path.replace('*', matchedStar)
    );
  }

  return pathMappings[matchedPatternText];
}

function tryResolveModuleFromBuiltDeps(
  moduleName: string,
  pathMappings: { [key: string]: string[] },
  workspaceRoot: string
): string | undefined {
  const modulePaths = getPathsForModule(moduleName, pathMappings);

  for (const output of modulePaths) {
    const fullOutputPath = join(workspaceRoot, output);
    const stats = statSync(fullOutputPath);
    if (stats.isFile()) {
      return fullOutputPath;
    }
    const packageJsonPath = join(fullOutputPath, 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson = readJsonFile(packageJsonPath);
      if (packageJson.main) {
        return join(fullOutputPath, packageJson.main);
      }
    }
  }

  return undefined;
}
