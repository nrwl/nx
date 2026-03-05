import { centerStringInWidth } from './ui';

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

export class ProgressDisplay {
  private current = 0;
  private total: number;
  private lastFile = '';
  private initialized: boolean = false;

  constructor(total: number) {
    this.total = total;
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
