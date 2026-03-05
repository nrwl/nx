import fs, { Dirent, existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'path';
import pc from 'picocolors';
import { termSize, truncateEnd } from './ui';

const SEARCH_DEPTH = 3;

// Directories to never recurse into.  We still detect node_modules
// *presence* (marks a workspace root) via a stat, just don't list inside it.
const SKIP_RECURSE = new Set([
  // VCS
  '.git',
  '.svn',
  '.hg',
  // Package managers (contents, not the marker)
  'node_modules',
  '.yarn',
  '.pnpm',
  // Build / framework caches
  '.cache',
  '.next',
  '.nuxt',
  '.output',
  '.turbo',
  '.angular',
  // Editor / IDE
  '.vscode',
  '.idea',
  // OS
  '.Trash',
]);

// ── Keypress parsing ────────────────────────────────────────────────

interface KeyPress {
  name: string; // e.g. 'a', 'enter', 'backspace', 'up', 'tab'
  ctrl: boolean;
  meta: boolean; // Alt / Option
  char: string; // printable character, or '' for special keys
}

function parseKeypress(data: Buffer): KeyPress {
  const raw = data.toString();

  // Meta (Alt/Option) + key: ESC followed by a single character
  if (raw.length === 2 && raw[0] === '\x1b' && raw[1] !== '[') {
    const ch = raw[1];
    if (ch === '\x7f')
      return { name: 'backspace', ctrl: false, meta: true, char: '' };
    return { name: ch, ctrl: false, meta: true, char: ch };
  }

  // CSI sequences: ESC [ <letter>
  if (raw.startsWith('\x1b[')) {
    const suffix = raw.slice(2);
    const csiMap: Record<string, string> = {
      A: 'up',
      B: 'down',
      C: 'right',
      D: 'left',
      H: 'home',
      F: 'end',
    };
    const name = csiMap[suffix] ?? `unknown(${suffix})`;
    return { name, ctrl: false, meta: false, char: '' };
  }

  // Single-byte control characters
  if (raw.length === 1 && raw.charCodeAt(0) < 0x20) {
    const code = raw.charCodeAt(0);
    const ctrlMap: Record<number, string> = {
      0x03: 'c', // Ctrl+C
      0x08: 'backspace', // Ctrl+H (legacy backspace)
      0x09: 'tab',
      0x0d: 'enter',
      0x15: 'u', // Ctrl+U
      0x17: 'w', // Ctrl+W
    };
    const name = ctrlMap[code] ?? String.fromCharCode(code + 0x60);
    const isCtrl = code !== 0x09 && code !== 0x0d; // tab/enter aren't "ctrl" keys
    return { name, ctrl: isCtrl, meta: false, char: '' };
  }

  // DEL (0x7f) — Backspace on most terminals
  if (raw === '\x7f') {
    return { name: 'backspace', ctrl: false, meta: false, char: '' };
  }

  // Printable characters (including pasted multi-char text)
  return { name: raw, ctrl: false, meta: false, char: raw };
}

// ── Input parsing ────────────────────────────────────────────────────

interface ParsedInput {
  resolvedSearchDir: string;
  filter: string;
  prefix: string;
  selfDisplay: string | null;
}

function parseInput(input: string): ParsedInput {
  let searchDir: string;
  let filter: string;
  let prefix: string;

  const expanded = input.startsWith('~/')
    ? (process.env.HOME || '') + input.slice(1)
    : input;

  if (expanded === '' || expanded.endsWith('/')) {
    searchDir = expanded || '.';
    filter = '';
    prefix = input;
  } else {
    const d = dirname(expanded);
    searchDir = d;
    filter = basename(expanded).toLowerCase();
    const inputDir = dirname(input);
    prefix = inputDir === '.' ? '' : inputDir + '/';
  }

  const resolvedSearchDir = resolve(searchDir);

  // Self-directory: show the search dir itself when there's no child filter
  // (empty input, trailing slash, or the literal "." / ".." inputs).
  let selfDisplay: string | null = null;
  const showSelf = filter === '' || input === '.' || input === '..';
  if (showSelf && existsSync(join(resolvedSearchDir, 'node_modules'))) {
    selfDisplay =
      input === ''
        ? '.'
        : input.endsWith('/')
          ? input.replace(/\/+$/, '')
          : input;
  }

  return { resolvedSearchDir, filter, prefix, selfDisplay };
}

// ── Parallel directory walker ────────────────────────────────────────

/**
 * Walk directories in parallel, invoking `onFound` for each workspace root
 * (directory containing `node_modules`).  All entries within a directory
 * level are explored concurrently via Promise.all, which dramatically
 * reduces wall-clock time compared to a sequential async generator.
 */
async function walkWorkspaceDirs(
  dir: string,
  maxDepth: number,
  relPrefix: string,
  onFound: (relPath: string) => void,
  isCancelled: () => boolean
): Promise<void> {
  if (maxDepth < 0 || isCancelled()) return;

  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  if (isCancelled()) return;

  await Promise.all(
    entries.map(async (e) => {
      if (isCancelled()) return;
      if (!e.isDirectory() || SKIP_RECURSE.has(e.name)) return;

      const fullPath = join(dir, e.name);
      const relPath = relPrefix ? relPrefix + '/' + e.name : e.name;

      // Check for node_modules with a cheap stat rather than readdir
      try {
        await fs.promises.access(join(fullPath, 'node_modules'));
        if (!isCancelled()) onFound(relPath);
      } catch {
        // Not a workspace root — keep looking deeper
      }

      if (maxDepth > 0 && !isCancelled()) {
        await walkWorkspaceDirs(
          fullPath,
          maxDepth - 1,
          relPath,
          onFound,
          isCancelled
        );
      }
    })
  );
}

// ── Interactive picker ───────────────────────────────────────────────

export class DirectoryPicker {
  private input: string = '';
  private cursorPos: number = 0;
  private selectedIndex: number = -1; // -1 = on input line
  private suggestions: string[] = [];
  private lastRenderLines = 0;
  private resolvePromise!: (value: string) => void;

  // ── Scan cache ─────────────────────────────────────────────────────
  // Key: resolved search directory path
  // Value: all workspace-root relative paths found under that directory
  private scanCache = new Map<string, string[]>();
  private completedScans = new Set<string>();
  private activeScanKey: string | null = null;
  private cancelActiveScan: (() => void) | null = null;

  /** Visible suggestion count adapts to the terminal height */
  private get maxSuggestions(): number {
    const { rows } = termSize();
    return Math.max(3, Math.min(Math.floor(rows * 0.3), rows - 4));
  }

  run(): Promise<string> {
    return new Promise<string>((res) => {
      this.resolvePromise = res;
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', this.onKeypress);
      this.updateSuggestions();
      this.render();
    });
  }

  private onKeypress = (data: Buffer) => {
    const key = parseKeypress(data);

    // ── Action keys ───────────────────────────────────────────────
    if (key.ctrl && key.name === 'c') {
      this.cleanup();
      process.exit(0);
    }

    if (key.name === 'enter') {
      const value =
        this.selectedIndex >= 0
          ? this.suggestions[this.selectedIndex]
          : this.input;
      this.cleanup();
      this.resolvePromise(value);
      return;
    }

    if (key.name === 'tab') {
      if (this.suggestions.length > 0) {
        const idx = Math.max(this.selectedIndex, 0);
        this.input = this.suggestions[idx];
        this.cursorPos = this.input.length;
        this.selectedIndex = -1;
        this.updateSuggestions();
      }
      this.render();
      return;
    }

    // ── Navigation ────────────────────────────────────────────────
    if (key.name === 'up') {
      this.selectedIndex = this.selectedIndex > 0 ? this.selectedIndex - 1 : -1;
      this.render();
      return;
    }

    if (key.name === 'down') {
      if (this.selectedIndex < this.suggestions.length - 1) {
        this.selectedIndex++;
      }
      this.render();
      return;
    }

    if (key.name === 'right') {
      if (this.cursorPos < this.input.length) this.cursorPos++;
      this.render();
      return;
    }

    if (key.name === 'left') {
      if (this.cursorPos > 0) this.cursorPos--;
      this.render();
      return;
    }

    // ── Deletion ──────────────────────────────────────────────────
    if (key.ctrl && key.name === 'u') {
      this.input = '';
      this.cursorPos = 0;
      this.selectedIndex = -1;
      this.updateSuggestions();
      this.render();
      return;
    }

    // Ctrl+W or Meta+Backspace — delete word backward
    if (
      (key.ctrl && key.name === 'w') ||
      (key.meta && key.name === 'backspace')
    ) {
      this.deleteWordBackward();
      this.render();
      return;
    }

    if (key.name === 'backspace') {
      if (this.cursorPos > 0) {
        this.input =
          this.input.slice(0, this.cursorPos - 1) +
          this.input.slice(this.cursorPos);
        this.cursorPos--;
        this.selectedIndex = -1;
        this.updateSuggestions();
      }
      this.render();
      return;
    }

    // ── Printable text ────────────────────────────────────────────
    if (key.char) {
      this.input =
        this.input.slice(0, this.cursorPos) +
        key.char +
        this.input.slice(this.cursorPos);
      this.cursorPos += key.char.length;
      this.selectedIndex = -1;
      this.updateSuggestions();
      this.render();
    }
  };

  private deleteWordBackward() {
    if (this.cursorPos <= 0) return;
    const before = this.input.slice(0, this.cursorPos);
    // Delete trailing slashes, then back to the previous slash or start
    const trimmed = before.replace(/\/+$/, '');
    const lastSlash = trimmed.lastIndexOf('/');
    const newEnd = lastSlash === -1 ? 0 : lastSlash + 1;
    this.input = this.input.slice(0, newEnd) + this.input.slice(this.cursorPos);
    this.cursorPos = newEnd;
    this.selectedIndex = -1;
    this.updateSuggestions();
  }

  // ── Suggestion management ──────────────────────────────────────────

  /**
   * Recompute `this.suggestions` from the cache using the current input.
   * Pure synchronous filter — no I/O.
   */
  private refreshSuggestions() {
    const parsed = parseInput(this.input);

    this.suggestions = parsed.selfDisplay ? [parsed.selfDisplay] : [];

    const cached = this.scanCache.get(parsed.resolvedSearchDir);
    if (!cached) return;

    for (const relPath of cached) {
      if (parsed.filter) {
        const firstSegment = relPath.split('/')[0].toLowerCase();
        if (!firstSegment.startsWith(parsed.filter)) continue;
      }

      const displayPath = parsed.prefix + relPath;

      // Insert in sorted position
      const insertIdx = this.suggestions.findIndex((s) => s > displayPath);
      if (insertIdx === -1) {
        this.suggestions.push(displayPath);
      } else {
        this.suggestions.splice(insertIdx, 0, displayPath);
      }
    }
  }

  /**
   * Called on every input change.  Refreshes suggestions from cache instantly,
   * then starts an async scan if the search directory hasn't been fully scanned.
   */
  private updateSuggestions() {
    const parsed = parseInput(this.input);
    const cacheKey = parsed.resolvedSearchDir;

    // Always refresh from whatever's in the cache (instant)
    this.refreshSuggestions();

    if (!existsSync(cacheKey)) return;

    // If this directory is fully scanned, we're done — cache has everything
    if (this.completedScans.has(cacheKey)) return;

    // If there's already an active scan for this same directory, let it run
    if (this.activeScanKey === cacheKey) return;

    // Different directory (or first time) — cancel any old scan, start new
    this.cancelActiveScan?.();
    this.activeScanKey = cacheKey;

    if (!this.scanCache.has(cacheKey)) {
      this.scanCache.set(cacheKey, []);
    }

    this.startScan(cacheKey);
  }

  private async startScan(cacheKey: string) {
    let cancelled = false;
    this.cancelActiveScan = () => {
      cancelled = true;
    };

    const cache = this.scanCache.get(cacheKey)!;

    // Schedule suggestion refresh + render as a macrotask so that
    // keypress events (also macrotasks) get interleaved rather than
    // starved behind a flood of Promise.all microtask continuations.
    let renderPending = false;
    const scheduleRender = () => {
      if (renderPending) return;
      renderPending = true;
      setImmediate(() => {
        renderPending = false;
        if (!cancelled) {
          this.refreshSuggestions();
          this.render();
        }
      });
    };

    await walkWorkspaceDirs(
      cacheKey,
      SEARCH_DEPTH,
      '',
      (relPath) => {
        cache.push(relPath);
        scheduleRender();
      },
      () => cancelled
    );

    // Final render to pick up any results from the last batch
    if (!cancelled) {
      this.refreshSuggestions();
      this.render();
      this.completedScans.add(cacheKey);
      this.activeScanKey = null;
      this.cancelActiveScan = null;
    }
  }

  // ── Rendering ──────────────────────────────────────────────────────

  private render() {
    const CLR = '\x1b[K'; // clear to end of line (terminal control, not a color)

    // On subsequent renders the cursor is on the input line (from prior
    // positioning).  Just return the cursor to column 0 so we overwrite in
    // place.  On the first render lastRenderLines is 0, so this is a no-op.
    if (this.lastRenderLines > 0) {
      process.stdout.write('\r');
    }

    const { cols } = termSize();

    // ── Input line ──────────────────────────────────────────────────
    const promptLabel = `  ${pc.cyan('>')} Repo path: `;
    const promptVisualLen = '  > Repo path: '.length; // without ANSI
    const maxInputDisplay = cols - promptVisualLen - 1;
    const displayInput =
      this.input.length > maxInputDisplay
        ? '…' + this.input.slice(-(maxInputDisplay - 1))
        : this.input;
    process.stdout.write(`${promptLabel}${displayInput}${CLR}\n`);

    // Blank separator between input and suggestions
    process.stdout.write(`${CLR}\n`);

    // ── Suggestion lines ────────────────────────────────────────────
    const visible = this.suggestions.slice(0, this.maxSuggestions);
    const shownSuggestions = visible.length;
    const pointer = ' › ';
    const noPointer = '   ';
    const indent = '  ';
    const maxSuggestionLen = cols - indent.length - pointer.length - 1;

    for (let i = 0; i < shownSuggestions; i++) {
      const text = truncateEnd(visible[i], maxSuggestionLen);
      if (i === this.selectedIndex) {
        process.stdout.write(
          `${indent}${pc.cyan(pointer)}${pc.inverse(` ${text} `)}${CLR}\n`
        );
      } else {
        process.stdout.write(
          `${indent}${pc.dim(`${noPointer}${text}`)}${CLR}\n`
        );
      }
    }

    // ── Hint line ───────────────────────────────────────────────────
    process.stdout.write(
      `${pc.dim('  ↑↓ navigate  tab complete  enter select')}${CLR}\n`
    );

    // ── Clear leftover lines from previous render ───────────────────
    const totalLines = 1 + 1 + shownSuggestions + 1; // input + blank + suggestions + hint
    for (let i = totalLines; i < this.lastRenderLines; i++) {
      process.stdout.write(`${CLR}\n`);
    }

    // Track how many physical lines we wrote (including clears)
    const linesWritten = Math.max(totalLines, this.lastRenderLines);
    this.lastRenderLines = totalLines;

    // Every line we wrote ended with \n, so the cursor is now
    // `linesWritten` rows below the input line.  Move back up.
    if (linesWritten > 0) {
      process.stdout.write(`\x1b[${linesWritten}A`);
    }

    // Position cursor within the input (account for truncation)
    const inputOffset =
      this.input.length > maxInputDisplay
        ? this.cursorPos - (this.input.length - maxInputDisplay) + 1
        : this.cursorPos;
    const cursorCol = Math.max(
      promptVisualLen + 1,
      promptVisualLen + inputOffset + 1
    );
    process.stdout.write(`\x1b[${Math.min(cursorCol, cols)}G`);
  }

  private cleanup() {
    // Cancel any in-flight scan
    this.cancelActiveScan?.();

    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdin.removeListener('data', this.onKeypress);

    // Cursor is on the input line (from render positioning).
    // Go to column 0, then overwrite with the final value.
    const finalValue =
      this.selectedIndex >= 0
        ? this.suggestions[this.selectedIndex]
        : this.input;
    process.stdout.write(`\r  Repo path: ${finalValue}\x1b[K\n`);

    // Clear all the suggestion / hint lines below
    for (let i = 1; i < this.lastRenderLines; i++) {
      process.stdout.write('\x1b[K\n');
    }

    // Move back up so subsequent output starts right after the input line
    if (this.lastRenderLines > 1) {
      process.stdout.write(`\x1b[${this.lastRenderLines - 1}A`);
    }
  }
}
