import { hash } from 'crypto';
import fs, { existsSync, readFileSync } from 'fs';
import { readJsonSync } from 'fs-extra';
import { dirname, join, relative } from 'path';
import { globSync } from 'tinyglobby';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const packages = globSync(`packages/*/package.json`).map(
  (p) => readJsonSync(p).name
);

const centerStringInWidth = (str: string, width: number): string => {
  const padding = Math.max(0, width - str.length);
  const padStart = Math.floor(padding / 2);
  const padEnd = padding - padStart;
  return ' '.repeat(padStart) + str + ' '.repeat(padEnd);
};

// Progress display utilities
function getProgressBar(current: number, total: number, width = 40): string {
  const percentage = total > 0 ? current / total : 0;
  const filled = Math.round(width * percentage);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function truncateStart(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return '...' + str.slice(-(maxLen - 3));
}

let progressDisplayInstance: ProgressDisplay | null = null;

function asciiBlock(w: number, px: number, py: number, text: string) {
  const lines = text.split('\n');
  const contentWidth = w - px * 2 - 2;
  const paddedLines = lines.map((line) => {
    const truncatedLine =
      line.length > contentWidth
        ? line.slice(0, contentWidth - 3) + '...'
        : line;
    return centerStringInWidth(truncatedLine, w - 2);
  });
  const emptyLine = ' '.repeat(w - 2);
  const blockLines = [
    '┌' + '─'.repeat(w - 2) + '┐',
    ...Array(py).fill('│' + emptyLine + '│'),
    ...paddedLines.map((line) => '│' + line + '│'),
    ...Array(py).fill('│' + emptyLine + '│'),
    '└' + '─'.repeat(w - 2) + '┘',
  ];
  return blockLines;
}

class ProgressDisplay {
  private current = 0;
  private total: number;
  private lastFile = '';
  private initialized: boolean = false;

  constructor(total: number) {
    this.total = total;
    progressDisplayInstance = this;
  }

  insertBefore(str: string) {
    process.stdout.write('\x1b[J');
    console.log(str);
  }

  row(maxWidth: number, minGap: number, ...parts: string[]): string {
    const totalPartsLength = parts.reduce((sum, part) => sum + part.length, 0);
    const calculatedGap = (maxWidth - totalPartsLength) / (parts.length - 1);
    if (calculatedGap < minGap) {
      const neededReduction = (minGap - calculatedGap) * (parts.length - 1);
      parts[0] = truncateStart(parts[0], parts[0].length - neededReduction);
    }
    return parts.join(' '.repeat(Math.max(calculatedGap, minGap)));
  }

  update(file: string, message?: string): void {
    this.current++;
    this.lastFile = file;

    // Move cursor up 3 lines and clear each line
    if (this.initialized) {
      process.stdout.write('\x1b[2F');
    } else {
      this.initialized = true;
    }

    if (message) {
      this.insertBefore(message);
    }
    this.renderCurrentStatus();
  }

  private renderCurrentStatus() {
    const termWidth = process.stdout.columns || 80;
    const adjustedTermWidth = termWidth - Math.floor(0.2 * termWidth);
    const progressBar = getProgressBar(
      this.current,
      this.total,
      adjustedTermWidth
    );

    // Line 1: Most recently copied file
    process.stdout.write(
      centerStringInWidth(
        this.row(
          adjustedTermWidth,
          4,
          this.lastFile,
          `[${this.current} / ${this.total}]`
        ),
        termWidth
      ) + '\x1b[K\n'
    );
    // Line 2: Progress bar
    process.stdout.write(
      centerStringInWidth(progressBar, termWidth) + '\x1b[K\n'
    );
  }

  finish(): void {
    // Add a newline after completion to separate from next output
    process.stdout.write('\n');
  }
}

yargs(hideBin(process.argv)).command({
  command: '$0',
  builder: (yargs) =>
    yargs
      .option('package', {
        type: 'string',
        choices: packages,
        description: 'The package to copy the build outputs from',
        demandOption: true,
      })
      .option('repo', {
        type: 'string',
        description: 'The root path of the repo to copy the built packages to',
        demandOption: true,
      }),
  handler: (argv) => {
    const termWidth = process.stdout.columns || 80;
    const renderWidth = termWidth - termWidth * 0.2;
    console.log();
    console.log(
      asciiBlock(
        renderWidth,
        2,
        1,
        `Copying ${argv.package} to ${argv.repo}/node_modules/${argv.package}`
      )
        .map((line) => centerStringInWidth(line, termWidth))
        .join('\n')
    );
    copyBuiltPackage(argv.package, argv.repo);
  },
}).argv;

function copyBuiltPackage(pkg: string, outputWorkspace: string) {
  const pkgRoot = join('packages', pkg);
  const pathInDist = join(__dirname, '../dist', pkgRoot);
  const copyRoot = existsSync(pathInDist) ? pathInDist : pkgRoot;

  if (copyRoot === pkgRoot) {
    console.warn(`No build artifacts in "${pathInDist}, checking project root`);
  }

  // Copy all files from dist/packages/<pkg> to the output package root
  const files = globSync(`**/*.js`, {
    cwd: copyRoot,
    dot: true,
    ignore: ['**/node_modules/**'],
  });

  if (!files.length) {
    throw new Error(
      `Unable to find built artifacts for ${pkg}. Did you forget to build?`
    );
  }

  const outputPkgRoot = join(outputWorkspace, 'node_modules', pkg);
  fs.mkdirSync(outputPkgRoot, { recursive: true });

  // Get native files count for accurate total
  const nativeFiles = getNativeFiles(pkg);
  const totalFiles = files.length + nativeFiles.length;
  const progress = new ProgressDisplay(totalFiles);

  files.forEach((file) => {
    const destFile = join(outputPkgRoot, file);
    const destDir = dirname(destFile);
    const copySrc = join(copyRoot, file);
    const relativeFilePath = relative(copyRoot, copySrc);
    progress.update(relativeFilePath);
    fs.mkdirSync(destDir, { recursive: true });
    safeCopyFileSync(copySrc, destFile);
  });

  // Copy native files
  copyNativeFiles(pkg, outputPkgRoot, nativeFiles, progress);
  progress.finish();
}

function getNativeFiles(pkg: string): string[] {
  const copyRoot = join(__dirname, '../packages', pkg);
  return globSync(`**/*.{node,wasm,js,mjs,cjs}`, {
    ignore: [
      '**/node_modules/**',
      'src/command-line/migrate/run-migration-process.js',
    ],
    cwd: copyRoot,
  });
}

function copyNativeFiles(
  pkg: string,
  outputPkgRoot: string,
  nativeFiles: string[],
  progress: ProgressDisplay
) {
  const copyRoot = join(__dirname, '../packages', pkg);
  nativeFiles.forEach((file) => {
    const destFile = join(outputPkgRoot, file);
    const destDir = dirname(destFile);
    const copySrc = join(copyRoot, file);
    const relativeFilePath = relative(copyRoot, copySrc);
    progress.update(relativeFilePath);
    fs.mkdirSync(destDir, { recursive: true });
    safeCopyFileSync(copySrc, destFile);
  });
}

function safeCopyFileSync(src: string, dest: string) {
  const sha = hash('sha256', readFileSync(src));
  for (let i = 0; i < 3; i++) {
    try {
      fs.copyFileSync(src, dest);
      const destSha = hash('sha256', readFileSync(dest));
      if (sha === destSha) {
        return;
      } else {
        progressDisplayInstance?.insertBefore(
          `Hash mismatch when copying ${src} to ${dest}, retrying...`
        );
      }
    } catch (e) {
      progressDisplayInstance?.insertBefore(
        `Error copying file ${src} to ${dest}: ${(e as Error).message}, retrying...`
      );
    }
  }
  throw new Error(`Failed to copy ${src} to ${dest} after 3 attempts.`);
}
