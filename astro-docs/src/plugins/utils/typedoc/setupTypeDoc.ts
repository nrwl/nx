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
import { ReflectionKind, type TypeDocOptions } from 'typedoc';

export const categoryMap: Record<number, string> = {
  [ReflectionKind.Class]: 'Classes',
  [ReflectionKind.Enum]: 'Enumerations',
  [ReflectionKind.Function]: 'Functions',
  [ReflectionKind.Interface]: 'Interfaces',
  [ReflectionKind.TypeAlias]: 'Type Aliases',
  [ReflectionKind.Variable]: 'Variables',
};

export const allowedReflections = [
  ReflectionKind.Class,
  ReflectionKind.Enum,
  ReflectionKind.Function,
  ReflectionKind.Interface,
  ReflectionKind.TypeAlias,
  ReflectionKind.Variable,
];

export function setupTypeDoc(logger: LoaderContext['logger']) {
  const tempDir = join(tmpdir(), `nx-devkit-docs`);
  const projectRoot = process.cwd();
  const buildDir = join(workspaceRoot, 'dist', 'packages', 'devkit');
  const outDir = join(tempDir, 'docs', 'generated', 'devkit');

  mkdirSync(buildDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(tempDir, 'packages', 'devkit'), { recursive: true });

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

  cpSync(tsconfigLibPath, join(buildDir, 'tsconfig.lib.json'));
  if (existsSync(tsconfigPath)) {
    cpSync(tsconfigPath, join(tempDir, 'packages', 'devkit', 'tsconfig.json'));
  }
  if (existsSync(tsconfigBasePath)) {
    cpSync(tsconfigBasePath, join(tempDir, 'tsconfig.base.json'));
  }

  let tsconfigContent = readFileSync(
    join(buildDir, 'tsconfig.lib.json'),
    'utf-8'
  );
  const tsconfigObj = JSON.parse(tsconfigContent);

  // remap to generated tsconfig to resolve correct local packages
  if (tsconfigObj.extends === '../../tsconfig.base.json') {
    tsconfigObj.extends = join(tempDir, 'packages', 'devkit', 'tsconfig.json');
  }

  tsconfigObj.compilerOptions = tsconfigObj.compilerOptions || {};
  tsconfigObj.compilerOptions.rootDir = projectRoot;
  tsconfigObj.compilerOptions.typeRoots = [
    join(projectRoot, 'node_modules', '@types'),
  ];

  tsconfigObj.exclude = [
    ...(tsconfigObj.exclude || []),
    '**/*.spec.ts',
    '**/*.test.ts',
    '**/test/**',
    '**/tests/**',
    'node_modules/@types/jasmine/**',
    'node_modules/@types/jest/**',
  ];

  writeFileSync(
    join(buildDir, 'tsconfig.lib.json'),
    JSON.stringify(tsconfigObj, null, 2)
  );

  rmSync(outDir, { recursive: true, force: true });

  const defaultTypedocOptions: Partial<TypeDocOptions> & {
    [key: string]: unknown;
  } = {
    plugin: ['typedoc-plugin-markdown'],
    disableSources: true,
    theme: 'markdown',
    readme: 'none',
    hideBreadcrumbs: true,
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
    buildDir,
    defaultTypedocOptions,
  };
}
