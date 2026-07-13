import { join } from 'path';
import { Tree } from '../../generators/tree';
import {
  detectPackageManager,
  getPackageManagerCommand,
  PackageManager,
} from '../../utils/package-manager';

const SKILL_ROOT_DIRS = [
  '.agents/skills',
  '.cursor/skills',
  '.github/skills',
  '.opencode/skills',
  '.gemini/skills',
  '.claude/skills',
];

/**
 * Skill templates in nx-ai-agents-config are authored with pnpm examples.
 * Rewrite them to match the workspace package manager when copied or refreshed.
 */
export function adaptSkillFilesToPackageManager(
  tree: Tree,
  directory: string
): void {
  const workspaceDir = join(tree.root, directory);
  const packageManager = detectPackageManager(workspaceDir);
  if (packageManager === 'pnpm') {
    return;
  }

  const commands = getPackageManagerCommand(packageManager, workspaceDir);
  const nxPrefix = getNxCommandPrefix(packageManager);

  for (const skillRoot of SKILL_ROOT_DIRS) {
    const basePath = join(directory, skillRoot);
    if (!tree.exists(basePath)) {
      continue;
    }
    for (const filePath of listFilesRecursive(tree, basePath)) {
      if (!filePath.endsWith('.md')) {
        continue;
      }
      const content = tree.read(filePath, 'utf-8');
      if (!content?.includes('pnpm')) {
        continue;
      }
      tree.write(
        filePath,
        adaptSkillContent(content, packageManager, commands, nxPrefix)
      );
    }
  }
}

function listFilesRecursive(tree: Tree, dir: string): string[] {
  const files: string[] = [];
  for (const child of tree.children(dir)) {
    const childPath = join(dir, child);
    if (tree.isFile(childPath)) {
      files.push(childPath);
    } else {
      files.push(...listFilesRecursive(tree, childPath));
    }
  }
  return files;
}

function getNxCommandPrefix(packageManager: PackageManager): string {
  switch (packageManager) {
    case 'yarn':
      return 'yarn';
    case 'npm':
      return 'npm exec';
    case 'bun':
      return 'bunx';
    default:
      return 'pnpm';
  }
}

function adaptSkillContent(
  content: string,
  packageManager: PackageManager,
  commands: ReturnType<typeof getPackageManagerCommand>,
  nxPrefix: string
): string {
  const replacements: [string, string][] = [
    ['pnpm add -Dw', commands.addDev],
    ['pnpm add -wD', commands.addDev],
    ['pnpm add -w', commands.add],
    ['pnpm add -D', commands.addDev],
    ['pnpm add', commands.add],
    ['pnpm install', commands.install],
    ['pnpm exec', commands.exec],
    ['pnpm dlx', commands.dlx],
    ['pnpx', commands.dlx],
    ['pnpm nx', `${nxPrefix} nx`],
  ];

  let adapted = content;
  for (const [from, to] of replacements) {
    adapted = adapted.split(from).join(to);
  }

  if (packageManager === 'yarn') {
    adapted = adapted
      .split('pnpm-workspace.yaml')
      .join('package.json `workspaces`');
    adapted = adapted.split('pnpm.overrides').join('resolutions');
  } else if (packageManager === 'npm') {
    adapted = adapted
      .split('pnpm-workspace.yaml')
      .join('package.json `workspaces`');
  } else if (packageManager === 'bun') {
    adapted = adapted.split('pnpm-workspace.yaml').join('package.json workspaces');
  }

  return adapted;
}
