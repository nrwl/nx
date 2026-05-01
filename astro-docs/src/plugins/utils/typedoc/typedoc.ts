import { workspaceRoot } from '@nx/devkit';
import type { LoaderContext } from 'astro/loaders';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  Application,
  PackageJsonReader,
  TSConfigReader,
  TypeDocReader,
  type TypeDocOptions,
} from 'typedoc';
import NxMarkdownTheme from './theme';

// Map directory names to categories
export const directoryToCategoryMap: Record<string, string> = {
  classes: 'Classes',
  enums: 'Enumerations',
  functions: 'Functions',
  interfaces: 'Interfaces',
  types: 'Type Aliases',
  variables: 'Variables',
};

export function setupTypeDoc(logger: LoaderContext['logger']) {
  const tempDir = join(tmpdir(), `nx-devkit-docs`);
  const projectRoot = process.cwd();
  const tsconfigDir = join(tempDir, 'packages', 'devkit');
  const generatedTsconfigPath = join(tsconfigDir, 'tsconfig.lib.json');
  const outDir = join(tempDir, 'docs', 'generated', 'devkit');

  mkdirSync(outDir, { recursive: true });
  mkdirSync(tsconfigDir, { recursive: true });

  const devkitPath = join(workspaceRoot, 'packages', 'devkit');
  const tsconfigLibPath = join(devkitPath, 'tsconfig.lib.json');
  const tsconfigPath = join(devkitPath, 'tsconfig.json');
  const tsconfigBasePath = join(workspaceRoot, 'tsconfig.base.json');

  if (!existsSync(tsconfigLibPath)) {
    logger.warn(
      'tsconfig.lib.json not found, skipping DevKit documentation generation'
    );
    throw new Error(
      `tsconfig.lib.json not found, unable to generate docs. ${tsconfigLibPath}`
    );
  }

  cpSync(tsconfigLibPath, generatedTsconfigPath);
  if (existsSync(tsconfigPath)) {
    cpSync(tsconfigPath, join(tsconfigDir, 'tsconfig.json'));
  }
  if (existsSync(tsconfigBasePath)) {
    cpSync(tsconfigBasePath, join(tempDir, 'tsconfig.base.json'));
  }

  let tsconfigContent = readFileSync(generatedTsconfigPath, 'utf-8');
  const tsconfigObj = JSON.parse(tsconfigContent);

  // remap to generated tsconfig to resolve correct local packages
  if (tsconfigObj.extends === '../../tsconfig.base.json') {
    tsconfigObj.extends = join(tsconfigDir, 'tsconfig.json');
  }

  tsconfigObj.compilerOptions = tsconfigObj.compilerOptions || {};
  tsconfigObj.compilerOptions.rootDir = projectRoot;
  tsconfigObj.compilerOptions.typeRoots = [
    join(projectRoot, 'node_modules', '@types'),
  ];

  // This ensures that nx and @nx/<plugin> modules resolve to `dist` rather than what's installed in node_modules.
  // TODO(jack,caleb): If we move outDir from `dist/packages/nx` to `packages/nx/dist` like standard TS solution setup,
  //                   then this isn't needed anymore since we should have devDependencies that resolve to local
  //                   `node_modules` not the root one.
  tsconfigObj.compilerOptions.baseUrl = workspaceRoot;
  tsconfigObj.compilerOptions.paths = {
    'nx/*': ['dist/packages/nx/*', 'packages/nx/src/*'],
    '@nx/*': ['dist/packages/*', 'packages/*/src/*'],
  };

  tsconfigObj.exclude = [
    ...(tsconfigObj.exclude || []),
    '**/*.spec.ts',
    '**/*.test.ts',
    '**/test/**',
    '**/tests/**',
    'node_modules/@types/jasmine/**',
    'node_modules/@types/jest/**',
  ];

  // The tsconfig now lives in tempDir but it operates on devkit's compiled
  // dist (entry point is dist/packages/devkit/index.d.ts). Resolve include
  // patterns to absolute paths anchored at the dist directory so TypeDoc
  // picks up the .d.ts files instead of looking for sources next to the temp
  // tsconfig.
  const distDevkitDir = join(workspaceRoot, 'dist', 'packages', 'devkit');
  tsconfigObj.include = (tsconfigObj.include || ['**/*.ts']).map(
    (pattern: string) => join(distDevkitDir, pattern)
  );

  writeFileSync(generatedTsconfigPath, JSON.stringify(tsconfigObj, null, 2));

  rmSync(outDir, { recursive: true, force: true });

  const defaultTypedocOptions: Partial<TypeDocOptions> & {
    [key: string]: unknown;
  } = {
    plugin: ['typedoc-plugin-markdown'],
    disableSources: true,
    theme: 'nx-markdown-theme',
    readme: 'none',
    hideBreadcrumbs: true,
    // Disable automatic H1 generation this is done via astro now
    hidePageTitle: true,
    allReflectionsHaveOwnDocument: true,
    skipErrorChecking: true,
    compilerOptions: {
      skipLibCheck: true,
      skipDefaultLibCheck: true,
      noEmit: true,
    },
  };

  return {
    projectRoot,
    outDir,
    generatedTsconfigPath,
    defaultTypedocOptions,
  };
}

export async function runTypeDoc(
  options: Partial<TypeDocOptions> & { [key: string]: unknown },
  logger: LoaderContext['logger']
) {
  const app = await Application.bootstrapWithPlugins(
    options as Partial<TypeDocOptions>,
    [new TypeDocReader(), new PackageJsonReader(), new TSConfigReader()]
  );

  app.renderer.defineTheme('nx-markdown-theme', NxMarkdownTheme);

  const project = await app.convert();

  if (!project) {
    throw new Error('Failed to convert the project');
  }

  const outputDir = app.options.getValue('out');
  logger.info(`Generating typedoc files to ${outputDir}`);
  await app.generateDocs(project, outputDir);
}
