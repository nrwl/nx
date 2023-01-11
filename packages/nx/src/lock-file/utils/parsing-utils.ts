import { existsSync, readFileSync } from 'fs';
import { workspaceRoot } from '../../utils/workspace-root';
import { output } from '../../utils/output';
import { LockFileBuilder } from '../lock-file-builder';
import { LockFileNode } from './types';

export type UnresolvedDependencies<T> = Set<[string, string, T]>;

export function reportUnresolvedDependencies<T>(
  unresolvedDependencies: UnresolvedDependencies<T>
) {
  output.error({
    title: `Breaking out of the parsing to avoid infinite loop.`,
    bodyLines: [
      `Could not resolve following dependencies:`,
      ...Array.from(unresolvedDependencies).map(
        ([packageName, versionSpec]) => `- ${packageName}@${versionSpec}\n`
      ),
    ],
  });
}

export function getRootVersion(packageName: string): string {
  const fullPath = `${workspaceRoot}/node_modules/${packageName}/package.json`;

  if (existsSync(fullPath)) {
    const content = readFileSync(fullPath, 'utf-8');
    return JSON.parse(content).version;
  }
  if (process.env.NX_VERBOSE_LOGGING === 'true') {
    console.warn(`Could not find ${fullPath}`);
  }
  return;
}

export function addEdgeOuts({
  builder,
  node,
  section,
  isOptional,
  isOptionalFunc,
  depSpecFunc,
}: {
  builder: LockFileBuilder;
  node: LockFileNode;
  section: Record<string, string>;
  isOptional?: boolean;
  isOptionalFunc?: (depName: string) => boolean;
  depSpecFunc?: (depName: string, depVersion: string) => string;
}) {
  if (!depSpecFunc) {
    depSpecFunc = (depName, depVersion) => depVersion;
  }
  if (section) {
    Object.entries(section).forEach(([depName, depSpec]) => {
      builder.addEdgeOut(
        node,
        depName,
        depSpecFunc(depName, depSpec),
        isOptional ?? (isOptionalFunc && isOptionalFunc(depName))
      );
    });
  }
}
