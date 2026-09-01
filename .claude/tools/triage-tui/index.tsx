/**
 * The approval surface for staged issue mutations.
 *
 * Reached through `triage review`, never run directly — the entry script owns
 * choosing the state directory and reporting a missing install. Record reading
 * and writing come from `../triage` rather than being reimplemented here: two
 * parsers for one file format is how a hand-edit starts meaning different things
 * to different verbs.
 *
 * This lives in its own directory as its own workspace package because it runs
 * on a different stack from everything around it: opentui's renderer is native
 * FFI that is Bun-only today (its Node build throws "native FFI is not available
 * for this runtime yet"), and @opentui/react needs React 19 while the repo
 * catalog pins 18. Being a separate package keeps both confined here — the
 * CommonJS `triage` entry script beside it, and the root's React, are untouched.
 *
 * The renderer gives us the alternate screen, mouse support and a real scrollbox
 * for free, which is why there is no buffer bookkeeping or height budgeting in
 * this file any more.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createCliRenderer, defaultTextareaKeyBindings } from '@opentui/core';
import { createRoot, useKeyboard, useTerminalDimensions } from '@opentui/react';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
// oxlint-disable-next-line @nx/enforce-module-boundaries -- the entry script is a plain file, not a project
const triage = require('../triage');

/** One grey, so "secondary text" is a single decision rather than a prop that
 *  ink spelled `dimColor` and opentui spells as a colour. */
const DIM = '#8a8a8a';

/**
 * Enter submits; shift-enter makes a newline.
 *
 * The textarea ships the opposite default (enter inserts a newline, meta-enter
 * submits), which is right for an editor and wrong for a one-line-most-of-the-
 * time note field — and it contradicts the prompt this UI prints. Most notes are
 * a sentence, so the common case gets the unmodified key.
 */
const NOTE_KEYS = [
  ...defaultTextareaKeyBindings.filter(
    (b: { action: string }) => b.action !== 'newline' && b.action !== 'submit'
  ),
  { name: 'return', action: 'submit' },
  { name: 'kpenter', action: 'submit' },
  { name: 'return', shift: true, action: 'newline' },
];

/** The one definition of what the list shows. Shared so a reload and the render
 *  can never disagree about which records are on screen. */
function visibleOf(records: Record_[], pendingOnly: boolean): Record_[] {
  return pendingOnly
    ? records.filter(
        (r) => r.front.status === 'pending' || r.front.status === 'failed'
      )
    : records;
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'yellow',
  approved: 'green',
  'changes-requested': 'magenta',
  rejected: 'red',
  applied: 'gray',
  failed: 'red',
};

type Record_ = { front: any; body: string; file: string };

type Seg = { t: string; color?: string; dim?: boolean; bold?: boolean };
type Line = { segs: Seg[]; action?: 'copy-comment' };

const ln = (...segs: Seg[]): Line => ({ segs });
const blank: Line = { segs: [{ t: '' }] };
/**
 * The full key list, shown in the pane instead of crowding the footer.
 *
 * The footer keeps only the three keys a reviewer presses on nearly every issue.
 * Everything else was noise there — nine hints wrapped across two lines, which
 * is the point at which a legend stops being read at all.
 */
const HELP: Line[] = [
  ln({ t: 'keys', dim: true }),
  blank,
  ln(
    { t: '  j / k', color: 'cyan' },
    { t: '   or arrow keys — move between issues' }
  ),
  ln({ t: '  a', color: 'green' }, { t: '        approve' }),
  ln({ t: '  x', color: 'red' }, { t: '        reject' }),
  ln({ t: '  u', color: 'cyan' }, { t: '        back to pending' }),
  ln(
    { t: '  c', color: 'magenta' },
    { t: '        write a note back to the agent' }
  ),
  blank,
  ln({ t: '  e', color: 'cyan' }, { t: '        open the record in $EDITOR' }),
  ln({ t: '  o', color: 'cyan' }, { t: '        open the issue on GitHub' }),
  ln({ t: '  f', color: 'cyan' }, { t: '        show unsettled only' }),
  ln({ t: '  r', color: 'cyan' }, { t: '        reload from disk' }),
  ln({ t: '  q', color: 'cyan' }, { t: '        quit' }),
  blank,
  ln({ t: 'mouse', dim: true }),
  blank,
  ln(
    { t: '  click a row', color: 'cyan' },
    { t: '            select that issue' }
  ),
  ln(
    { t: '  click "N more"', color: 'cyan' },
    { t: '         page in that direction' }
  ),
  ln(
    { t: '  click "click to copy"', color: 'cyan' },
    { t: '  copy the comment, unwrapped' }
  ),
  ln(
    { t: '  wheel', color: 'cyan' },
    { t: '                  scroll this pane' }
  ),
  blank,
  ln({ t: '  esc or ? closes this', dim: true }),
];

/**
 * Wrap a line of COLOURED segments to the pane width.
 *
 * `wrapText` only knows about plain strings, and the label row is a run of
 * differently coloured chips — green adds, red removes, dim no-ops — so wrapping
 * it as one string would lose which chip was which. This walks the segments
 * instead, splitting at word boundaries and carrying each piece's colour onto
 * the next line. Continuation lines are indented so the chips stay in a column
 * under the first, the same shape the title and repro rows use.
 *
 * Truncating was the alternative and it was worse: a clipped label row silently
 * drops labels the record would actually apply, which is the one thing the
 * reviewer is there to check.
 */
function wrapSegs(segs: Seg[], width: number, indent = 0): Line[] {
  const pad = ' '.repeat(indent);
  const lines: Line[] = [];
  let cur: Seg[] = [];
  let used = 0;

  const flush = () => {
    if (cur.length) lines.push({ segs: cur });
    cur = [];
  };
  const newline = () => {
    flush();
    cur = indent ? [{ t: pad }] : [];
    used = indent;
  };

  for (const sg of segs) {
    let text = sg.t;
    // A run of spaces landing at a line start is the separator between two
    // chips; keeping it would indent the continuation by an extra column.
    if (used === indent && lines.length && !text.trim()) continue;
    while (text.length) {
      const room = width - used;
      if (text.length <= room) {
        cur.push({ ...sg, t: text });
        used += text.length;
        break;
      }
      // Break at the last space that fits; a token longer than the pane has no
      // break point, so cut it.
      let cut = text.lastIndexOf(' ', room);
      if (cut <= 0) cut = Math.max(1, room);
      const head = text.slice(0, cut);
      if (head.trim()) cur.push({ ...sg, t: head });
      newline();
      text = text.slice(cut).replace(/^ +/, '');
    }
  }
  flush();
  return lines;
}

/**
 * Wrap to the pane width ourselves rather than leaving it to the renderer.
 *
 * The detail pane has to be clipped to a known number of rows, and that is only
 * possible if the number of rows the content occupies is known before it
 * renders. Letting the renderer wrap means the height is whatever it turns out
 * to be, which is exactly how a long comment pushed the issue list off screen.
 */
function wrapText(text: string, width: number, indent = 0): string[] {
  const pad = ' '.repeat(indent);
  const room = Math.max(8, width - indent);
  const out: string[] = [];
  for (const raw0 of String(text).replace(/\t/g, '  ').split('\n')) {
    const raw = raw0.replace(/\s+$/, '');
    if (!raw.trim()) {
      out.push('');
      continue;
    }
    // A line that already fits is emitted verbatim. Splitting on whitespace and
    // rejoining with single spaces would silently destroy the column alignment
    // of any table or code block in the comment — i.e. exactly the content a
    // reviewer most needs to read as written before approving it.
    if (pad.length + raw.length <= width) {
      out.push(pad + raw);
      continue;
    }
    let cur = '';
    for (let word of raw.trim().split(/\s+/)) {
      // A token longer than the pane (a URL, a stack frame) has no break point,
      // so hard-split it instead of letting it overflow the row.
      while (word.length > room) {
        if (cur) {
          out.push(pad + cur);
          cur = '';
        }
        out.push(pad + word.slice(0, room));
        word = word.slice(room);
      }
      if (cur && cur.length + 1 + word.length > room) {
        out.push(pad + cur);
        cur = word;
      } else {
        cur = cur ? cur + ' ' + word : word;
      }
    }
    if (cur) out.push(pad + cur);
  }
  return out;
}

function detailLines(record: Record_, width: number): Line[] {
  const { front, body } = record;

  // current_* is captured at stage time and may be absent (offline, or an
  // older record). Without it we cannot claim a field is new, so we say
  // nothing rather than guess — an unverified "NEW" badge is worse than none.
  const known = Array.isArray(front.current_labels);
  const currentLabels: string[] = front.current_labels || [];
  const currentAssignees: string[] = front.current_assignees || [];

  const comment = triage.section(body, 'Comment');
  const rationale = triage.section(body, 'Rationale');
  const feedback = triage.section(body, 'Feedback');

  const out: Line[] = [];
  // The title wraps rather than truncating: it is the one field where the tail
  // carries as much meaning as the head, and a hanging indent keeps the issue
  // number the only thing in the left margin. Same shape as `repro` below.
  const head = `#${front.issue} `;
  const titleLines = wrapText(String(front.title || ''), width, head.length);
  out.push(
    ln(
      { t: head, bold: true },
      { t: (titleLines[0] || '').slice(head.length), color: 'cyan' }
    )
  );
  for (const l of titleLines.slice(1)) out.push(ln({ t: l, color: 'cyan' }));

  const labelSegs: Seg[] = [{ t: 'labels ', dim: true }];
  const adds = (front.add_labels || []) as string[];
  const removes = (front.remove_labels || []) as string[];
  adds.forEach((l, i) => {
    // An add already on the issue is a no-op; the same green as a real addition
    // overstates what approving this record actually does.
    const noop = known && currentLabels.includes(l);
    if (i) labelSegs.push({ t: '  ' });
    labelSegs.push(
      noop
        ? { t: `+${l} (already set)`, dim: true }
        : { t: `+${l}`, color: 'green' }
    );
  });
  removes.forEach((l) => {
    const noop = known && !currentLabels.includes(l);
    labelSegs.push({ t: '  ' });
    labelSegs.push(
      noop ? { t: `-${l} (not set)`, dim: true } : { t: `-${l}`, color: 'red' }
    );
  });
  if (adds.length || removes.length) {
    for (const l of wrapSegs(labelSegs, width, 'labels '.length)) out.push(l);
  }

  if (front.assign) {
    const isNew = known && !currentAssignees.includes(front.assign);
    const others = known
      ? currentAssignees.filter((a: string) => a !== front.assign)
      : [];
    const segs: Seg[] = [{ t: 'assign ', dim: true }];
    if (!known) segs.push({ t: `@${front.assign}` });
    else if (isNew) segs.push({ t: `+@${front.assign}`, color: 'green' });
    else segs.push({ t: `@${front.assign} (already assigned)`, dim: true });
    if (others.length) {
      segs.push({ t: `  replaces @${others.join(', @')}`, color: 'yellow' });
    }
    out.push(ln(...segs));
  } else {
    out.push(
      ln(
        { t: 'assign ', dim: true },
        { t: 'MISSING — every record needs one', color: 'red', bold: true }
      )
    );
  }

  if (front.linked_pr) {
    out.push(
      ln(
        { t: 'PR ', dim: true },
        { t: `#${front.linked_pr} already targets this`, color: 'yellow' }
      )
    );
  }
  if (front.close_reason) {
    out.push(
      ln(
        { t: 'close ', dim: true },
        {
          t: `CLOSES this issue as "${front.close_reason}"`,
          color: 'red',
          bold: true,
        }
      )
    );
  }
  if (front.repro) {
    // Wrapped WITH the indent, like every other field: wrapping to the full
    // width and then adding the label and a six-space hang made every line six
    // columns too long, and the terminal hard-wrapped the tail to column 0.
    const w = wrapText(front.repro, width, 6);
    out.push(ln({ t: 'repro ', dim: true }, { t: (w[0] || '').slice(6) }));
    for (const l of w.slice(1)) out.push(ln({ t: l }));
  }

  if (comment && comment !== '_none_') {
    out.push(blank);
    // The header doubles as the copy control. Putting it here rather than on a
    // hotkey keeps the action next to the thing it acts on, and says plainly
    // WHAT gets copied — the whole comment, not whatever a drag happened to
    // cover.
    out.push({
      segs: [
        { t: 'comment to post', dim: true },
        { t: '  ·  click to copy', color: 'cyan' },
      ],
      action: 'copy-comment',
    });
    for (const l of wrapText(comment, width, 2)) out.push(ln({ t: l }));
  } else {
    out.push(blank);
    out.push(ln({ t: 'no comment', dim: true }));
  }

  if (rationale && rationale !== '_none given_') {
    out.push(blank);
    out.push(ln({ t: 'why', dim: true }));
    for (const l of wrapText(rationale, width, 2))
      out.push(ln({ t: l, dim: true }));
  }

  if (feedback) {
    out.push(blank);
    out.push(ln({ t: 'your note back to the agent', color: 'magenta' }));
    for (const l of wrapText(feedback, width, 2))
      out.push(ln({ t: l, color: 'magenta' }));
  }

  return out;
}

// Created before the component so the $EDITOR handoff and the quit path can
// reach it. Top-level await is fine: this file is ESM and only ever runs on Bun.
const renderer = await createCliRenderer({ exitOnCtrlC: false });

/**
 * Timers and watchers this file owns, torn down before the renderer is.
 *
 * React effect cleanups do not run on process exit, so without this the poll
 * interval and the fs watcher are still live when opentui tears its native
 * buffers down — which aborts the process with a malloc double-free. Reproduced
 * on a minimal app: a bare renderer exits 0, and the same app with an interval
 * and a watch attached exits 5 with the same error, even through opentui's own
 * ctrl-c path.
 */
const cleanups: Array<() => void> = [];

/** Leave the screen, then print. Anything written while the renderer owns the
 *  terminal is destroyed along with the alternate buffer. */
function quit(): void {
  // Deferred out of the current frame. destroy() called straight from a key
  // handler tears down native buffers the renderer is still drawing into, which
  // aborts the process with a malloc double-free instead of exiting cleanly.
  // Deferred out of the current frame: destroy() called straight from a key
  // handler tears down buffers the renderer is still drawing into.
  setTimeout(() => {
    for (const fn of cleanups.splice(0)) {
      try {
        fn();
      } catch {
        /* a failed teardown must not block the rest */
      }
    }
    renderer.destroy();
    summarize();
    // No process.exit(): with our timers gone and the renderer down there is
    // nothing left to hold the loop open, and forcing an exit while Bun is
    // still unwinding the native renderer is what aborts the process.
  }, 0);
}

function App() {
  const [records, setRecords] = useState<Record_[]>(() => triage.listRecords());
  // Selection is an ISSUE, never a row offset.
  //
  // Records sort by number and the list grows under the reviewer while the agent
  // stages, so a row offset means something different after every reload — and
  // every reload path would need to restore it by hand. Keying by issue makes
  // that structural: `reload` can stay a bare setRecords, and `r`, a status
  // change, an $EDITOR round trip and the fs watcher all keep the selection
  // without knowing they had to.
  const [selectedIssue, setSelectedIssue] = useState<number | null>(() => {
    const first = triage.listRecords()[0];
    return first ? Number(first.front.issue) : null;
  });
  const [mode, setMode] = useState<'list' | 'comment' | 'help'>('list');
  // The status line under the key hints. `seq` rides along so posting the same
  // message twice still restarts the dismiss timer — without it, React sees an
  // unchanged string, the effect never re-runs, and the second message would
  // inherit whatever was left of the first one's countdown.
  const [flash, setFlashState] = useState<{ text: string; seq: number }>({
    text: '',
    seq: 0,
  });
  const [pendingOnly, setPendingOnly] = useState(false);
  // One resize listener for the whole app: FullScreenBox sizes the frame from
  // the same hook, so a second subscription here could disagree with it for a
  // frame and budget the detail pane against a stale height.
  const { width, height } = useTerminalDimensions();
  const size = { rows: height, cols: width };

  const selectedIssueRef = useRef<number | null>(null);
  selectedIssueRef.current = selectedIssue;

  const visible = useMemo(
    () => visibleOf(records, pendingOnly),
    [records, pendingOnly]
  );
  // Where the selected issue currently sits. -1 means it left the view — it was
  // approved under an active filter, say — and the cursor falls back to the row
  // that took its place rather than to the top of the list.
  const lastIndexRef = useRef(0);
  const foundAt = visible.findIndex(
    (r) => Number(r.front.issue) === selectedIssue
  );
  const index =
    foundAt >= 0
      ? foundAt
      : Math.max(0, Math.min(lastIndexRef.current, visible.length - 1));
  lastIndexRef.current = index;
  const current = visible[index];

  // Selection is an issue id; the row is derived from it. When that issue is no
  // longer ON SCREEN — archived away by an apply, or filtered out by `f` — the
  // id is repointed at whatever now occupies the position it held.
  //
  // This runs as an effect rather than inside the reload, because a record can
  // leave the view without the record set changing at all: approving under the
  // pending-only filter removes it from `visible` while it is still very much in
  // `records`. Reconciling on `visible` catches every one of those paths with a
  // single rule, and leaves no way for the id and the drawn cursor to disagree.
  useEffect(() => {
    if (
      selectedIssue != null &&
      visible.some((r) => Number(r.front.issue) === selectedIssue)
    ) {
      return;
    }
    const at = Math.max(0, Math.min(lastIndexRef.current, visible.length - 1));
    const landed = visible.length ? Number(visible[at].front.issue) : null;
    if (landed === selectedIssue) return;
    selectedIssueRef.current = landed;
    setSelectedIssue(landed);
  }, [visible, selectedIssue]);

  const currentIssueRef = useRef<number | null>(null);
  currentIssueRef.current = current ? Number(current.front.issue) : null;
  // Mirrors of state the fs.watch callback reads. It is created once, so it
  // would otherwise close over whatever `mode` was at mount.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const reloadPendingRef = useRef(false);
  // The issue a note is being written for, fixed when comment mode opens.
  const commentTargetRef = useRef<number | null>(null);
  // Reading the note back on submit: the buffer lives in the renderable, and
  // `plainText` is its accessor.
  const noteRef = useRef<{ plainText?: string } | null>(null);

  /**
   * Swap in a fresh set of records and REPOPULATE the selection.
   *
   * Keying selection by issue survives reordering on its own, but not deletion:
   * when the agent applies a record it is archived out of the list, and the
   * selected number then names something that no longer exists. Leaving that to
   * the render-time fallback means state and view disagree — the cursor is drawn
   * on one row while `selectedIssue` still points at the departed one, so the
   * next action targets the wrong issue. Re-point it here instead, at whatever
   * now occupies the position the selection was at.
   */
  const setFlash = useCallback((text: string) => {
    setFlashState((f) => ({ text, seq: f.seq + 1 }));
  }, []);

  // Messages are transient by nature — "opened #123", "agent restaged #456" are
  // true for a moment and then just clutter. Left up, the last one reads as the
  // current state of the app long after it stopped being true.
  useEffect(() => {
    if (!flash.text) return;
    const timer = setTimeout(
      () => setFlashState((f) => ({ ...f, text: '' })),
      4000
    );
    const stop = () => clearTimeout(timer);
    cleanups.push(stop);
    return () => {
      stop();
      const at = cleanups.indexOf(stop);
      if (at >= 0) cleanups.splice(at, 1);
    };
  }, [flash.seq, flash.text]);

  const applyRecords = useCallback((next: Record_[]) => {
    setRecords(next);
  }, []);

  const reload = useCallback(() => {
    applyRecords(triage.listRecords());
  }, [applyRecords]);

  const jumpTo = useCallback((issue: number) => {
    setSelectedIssue(Number(issue));
  }, []);

  /** Move the cursor by rows, resolving back to whichever issue lands under it. */
  const moveBy = useCallback(
    (delta: number) => {
      if (!visible.length) return;
      const next = Math.max(0, Math.min(index + delta, visible.length - 1));
      setSelectedIssue(Number(visible[next].front.issue));
    },
    [index, visible]
  );

  // Records arrive while this is open: the agent stages each issue as it decides
  // it rather than batching at the end, so the queue grows under the reviewer.
  // Reloading keeps the SELECTED issue selected rather than the selected row —
  // records sort by number, so an arrival above the cursor would otherwise move
  // the selection onto a different issue between reading it and pressing `a`.
  useEffect(() => {
    if (!fs.existsSync(triage.STATE_DIR)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let watcher: ReturnType<typeof fs.watch> | undefined;
    const bump = () => {
      clearTimeout(timer);
      // One `stage` writes a file and the journal; debouncing collapses that
      // burst into a single reload.
      timer = setTimeout(() => {
        // Never redraw the list under someone who is typing. Reordering rows
        // mid-note moves the detail pane they are reading. The reload is not
        // dropped — it runs when they leave comment mode.
        if (modeRef.current === 'comment') {
          reloadPendingRef.current = true;
          return;
        }
        applyRecords(triage.listRecords());
      }, 150);
    };
    try {
      watcher = fs.watch(triage.STATE_DIR, bump);
    } catch {
      /* live refresh is a convenience; `r` still reloads by hand */
    }
    const stop = () => {
      clearTimeout(timer);
      watcher?.close();
    };
    cleanups.push(stop);
    return () => {
      stop();
      const at = cleanups.indexOf(stop);
      if (at >= 0) cleanups.splice(at, 1);
    };
  }, [applyRecords]);

  /** Apply a reload that arrived while the reviewer was typing. */
  const drainReload = useCallback(() => {
    if (!reloadPendingRef.current) return;
    reloadPendingRef.current = false;
    applyRecords(triage.listRecords());
  }, [applyRecords]);

  const setStatus = useCallback(
    (status: string, note?: string, issue?: number | null) => {
      // The caller may name the issue. A note typed over several seconds is
      // submitted against the issue it was STARTED on, not whatever the cursor
      // happens to sit on when Enter lands.
      const target = issue ?? (current ? Number(current.front.issue) : null);
      if (target == null) return;
      const { front, body } = triage.readRecord(target);
      front.status = status;
      const next = note
        ? triage.buildBody({
            comment: triage.section(body, 'Comment'),
            rationale: triage.section(body, 'Rationale'),
            feedback: note,
          })
        : body;
      triage.writeRecord(front, next);
      setFlash(`#${front.issue} -> ${status}`);
      reload();
    },
    [current, reload]
  );

  const openEditor = useCallback(() => {
    if (!current) return;
    const editor = process.env.VISUAL || process.env.EDITOR || 'vi';
    // suspend() hands the terminal back — leaves the alternate buffer, restores
    // the cooked mode and stops the render loop — so the editor gets a clean
    // screen rather than fighting the renderer for it.
    renderer.suspend();
    spawnSync(editor, [triage.recordPath(current.front.issue)], {
      stdio: 'inherit',
    });
    renderer.resume();
    setFlash(`reloaded #${current.front.issue} from disk`);
    reload();
  }, [current, reload]);

  /**
   * Copy the comment as it would be POSTED, not as it is drawn.
   *
   * The pane shows it wrapped to the pane width and indented two spaces, so
   * anything taken off the screen carries those line breaks and that indent —
   * paste it into GitHub and the paragraph is broken mid-sentence. The record
   * holds the real string, so it comes from there: what lands on the clipboard
   * is exactly what `triage apply` would post.
   */
  const copyComment = useCallback(() => {
    if (!current) return;
    const text = triage.section(current.body, 'Comment');
    if (!text || text === '_none_') {
      setFlash('no comment on this record');
      return;
    }
    // OSC 52 hands the text to the terminal emulator, so it works over ssh and
    // inside a multiplexer — there is no host clipboard reachable from here.
    if (renderer.copyToClipboardOSC52(text)) {
      setFlash(
        `copied #${current.front.issue}'s comment — ${text.length} chars, unwrapped`
      );
    } else {
      setFlash('copy failed — this terminal does not support OSC 52');
    }
  }, [current, setFlash]);

  const openInBrowser = useCallback(() => {
    if (!current) return;
    const { url, issue } = current.front;
    if (!url) {
      setFlash('no url on this record');
      return;
    }
    // Detached and unref'd: the browser outlives the review session, and a
    // blocking spawn would freeze the TUI behind whatever the opener does.
    const [cmd, args] =
      process.platform === 'darwin'
        ? ['open', [url]]
        : process.platform === 'win32'
          ? ['cmd', ['/c', 'start', '', url]]
          : ['xdg-open', [url]];
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
    // spawn reports a missing opener asynchronously, so a try/catch would miss
    // it. Fall back to showing the URL, which is the useful thing anyway.
    child.on('error', () => setFlash(url));
    child.unref();
    setFlash(`opened #${issue}`);
  }, [current]);

  // Commands arrive from the supervising agent while the reviewer is mid-queue.
  // The handler goes through a ref so the poll interval can be created ONCE:
  // rebuilding it whenever `jumpTo` changed would reset the read offset to the
  // current end of file, silently swallowing every command written since.
  const onCommand = useRef<(cmd: any) => void>(() => {});
  onCommand.current = (cmd: any) => {
    if (cmd.type === 'reload') {
      // A reload refreshes the queue and MUST NOT move the cursor, even when it
      // names an issue. The agent restages constantly while the reviewer reads;
      // jumping to whatever it just wrote tore them off the issue they were
      // part-way through judging. The issue number becomes a note, not a jump.
      reload();
      setFlash(
        cmd.issue ? `agent restaged #${cmd.issue}` : 'agent refreshed the queue'
      );
    } else if (cmd.type === 'select') {
      jumpTo(cmd.issue);
      setFlash(`agent pointed at #${cmd.issue}`);
    } else if (cmd.type === 'message') {
      setFlash(`agent: ${cmd.text}`);
    }
  };

  useEffect(() => {
    const file = triage.COMMANDS_FILE;
    // Start at the current end: commands written before this TUI opened were
    // for a session that is over, and replaying them would yank the reviewer
    // to whatever the agent was doing an hour ago.
    let offset = 0;
    try {
      offset = fs.statSync(file).size;
    } catch {
      offset = 0;
    }
    const timer = setInterval(() => {
      let end: number;
      try {
        end = fs.statSync(file).size;
      } catch {
        return;
      }
      if (end < offset) offset = 0; // truncated or rotated under us
      if (end === offset) return;
      let chunk = '';
      try {
        const fd = fs.openSync(file, 'r');
        const buf = Buffer.alloc(end - offset);
        fs.readSync(fd, buf, 0, buf.length, offset);
        fs.closeSync(fd);
        chunk = buf.toString('utf8');
      } catch {
        return;
      }
      offset = end;
      for (const line of chunk.split('\n')) {
        if (!line.trim()) continue;
        try {
          onCommand.current(JSON.parse(line));
        } catch {
          /* a partial or malformed line is not worth killing the poll over */
        }
      }
    }, 400);
    const stop = () => clearInterval(timer);
    cleanups.push(stop);
    return () => {
      stop();
      const at = cleanups.indexOf(stop);
      if (at >= 0) cleanups.splice(at, 1);
    };
  }, []);

  // opentui delivers a KeyEvent with a `name` ('j', 'return', 'escape', 'up')
  // and the literal `sequence`. Printable input is taken from `sequence` rather
  // than `name` so that shifted and punctuation characters reach the draft
  // intact — `name` normalises them.
  useKeyboard((k) => {
    // The textarea owns editing entirely — text, caret, selection, word motions,
    // undo, wrapping, scrolling and PASTE all come from TextareaRenderable. Only
    // the two keys that leave the field are handled here, and the textarea has
    // focus so nothing else reaches this handler while a note is open.
    if (mode === 'comment') {
      if (k.name === 'escape') {
        setMode('list');
        drainReload();
      }
      return;
    }

    // Help is a mode rather than an overlay: it takes the pane, so there is
    // nothing underneath for a stray key to act on. Only the keys that leave it
    // do anything, except q — quitting should never need two steps.
    if (mode === 'help') {
      if (k.name === 'escape' || k.name === '?' || k.sequence === '?') {
        setMode('list');
      } else if (k.name === 'q') {
        quit();
      }
      return;
    }

    // ctrl-c is handled here rather than by the renderer (exitOnCtrlC is off),
    // so that quitting always goes through the same path that leaves the screen
    // before printing the summary.
    if (k.name === 'q' || (k.ctrl && k.name === 'c')) quit();
    else if (k.name === 'j' || k.name === 'down') moveBy(1);
    else if (k.name === 'k' || k.name === 'up') moveBy(-1);
    else if (k.name === 'a') setStatus('approved');
    else if (k.name === 'x') setStatus('rejected');
    else if (k.name === 'u') setStatus('pending');
    else if (k.name === 'c') {
      commentTargetRef.current = currentIssueRef.current;
      setMode('comment');
    } else if (k.name === 'e') openEditor();
    else if (k.name === 'o') openInBrowser();
    else if (k.name === 'r') {
      reload();
      setFlash('reloaded');
    } else if (k.name === 'f') {
      setPendingOnly((v) => !v);
    } else if (k.name === '?' || k.sequence === '?') {
      setMode('help');
    }
  });

  const counts = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.front.status] = (acc[r.front.status] || 0) + 1;
    return acc;
  }, {});

  if (!records.length) {
    return (
      <box padding={1}>
        <text fg={DIM}>
          Nothing staged. The agent writes records with `triage stage`.
        </text>
      </box>
    );
  }

  // The list stays windowed around the cursor so it cannot crowd out the detail
  // pane. The detail pane itself is a scrollbox — the renderer handles overflow
  // and the mouse wheel, so there is no height arithmetic here any more.
  // Lines the whole list block may occupy, overflow markers included — they are
  // rows in the list, not something drawn beside it.
  const LIST_H = Math.max(3, Math.min(9, size.rows - 12));

  // Solved in two passes because it is circular: whether a marker is needed
  // depends on how many issue rows fit, which depends on how many markers take
  // a line. Two passes settle it for any list length.
  let count = Math.min(LIST_H, visible.length);
  let start = 0;
  for (let pass = 0; pass < 2; pass++) {
    start = Math.max(
      0,
      Math.min(index - Math.floor(count / 2), visible.length - count)
    );
    const reserve =
      (start > 0 ? 1 : 0) + (start + count < visible.length ? 1 : 0);
    count = Math.max(1, Math.min(LIST_H - reserve, visible.length));
  }
  // The window may not leave the selection behind, whatever the arithmetic did.
  start = Math.max(0, Math.min(start, visible.length - count));
  if (index < start) start = index;
  if (index >= start + count) start = index - count + 1;

  const rows = visible.slice(start, start + count);
  const hiddenAbove = start;
  const hiddenBelow = visible.length - (start + count);
  const lines = current
    ? detailLines(current, Math.max(24, size.cols - 6))
    : [];

  return (
    <box flexDirection="column" width="100%" height="100%">
      <box paddingLeft={1}>
        <text>
          <b>triage </b>
          <span fg={DIM}>
            {Object.entries(counts)
              .map(([st, n]) => `${n} ${st}`)
              .join(', ')}
            {pendingOnly ? '  (showing unsettled only)' : ''}
          </span>
        </text>
      </box>

      {/* flexShrink on the CONTAINER too: its children no longer shrink, so a
          shrinking parent would just let them spill over the pane below it. */}
      <box flexDirection="column" marginTop={1} flexShrink={0}>
        {hiddenAbove ? (
          // A row like any other, so it cannot land on top of one. Clicking it
          // pages the selection that way — the window follows the selection, so
          // moving the cursor IS scrolling here.
          <box
            width="100%"
            flexShrink={0}
            onMouseDown={() => moveBy(-Math.max(1, count))}
          >
            <text fg={DIM}>{`   ↑ ${hiddenAbove} more`.padEnd(size.cols)}</text>
          </box>
        ) : null}
        {rows.map((r) => {
          const selected = r === current;
          const head = `#${r.front.issue} `;
          const title = truncate(r.front.title, r.front.close_reason ? 46 : 52);
          // Every row writes the FULL width. The renderer repaints the cells an
          // element covers, so a row that gets shorter than the one previously
          // drawn on that line leaves the tail of the old title behind. Padding
          // makes each row overwrite the whole line rather than a prefix of it.
          const used =
            3 +
            18 +
            (r.front.close_reason ? 6 : 0) +
            head.length +
            title.length;
          const fill = ' '.repeat(Math.max(0, size.cols - used));
          // A box, not the text itself: the box spans the full row so clicking
          // anywhere along it selects, rather than only the printed characters.
          return (
            <box
              key={r.front.issue}
              width="100%"
              flexShrink={0}
              onMouseDown={() => setSelectedIssue(Number(r.front.issue))}
            >
              <text>
                <span fg="cyan">{selected ? ' > ' : '   '}</span>
                <span fg={STATUS_COLOR[r.front.status] || 'white'}>
                  {String(r.front.status).padEnd(18)}
                </span>
                {r.front.close_reason ? <span fg="red">{'CLOSE '}</span> : null}
                <span>
                  {head}
                  {title}
                </span>
                <span>{fill}</span>
              </text>
            </box>
          );
        })}
        {hiddenBelow ? (
          <box
            width="100%"
            flexShrink={0}
            onMouseDown={() => moveBy(Math.max(1, count))}
          >
            <text fg={DIM}>{`   ↓ ${hiddenBelow} more`.padEnd(size.cols)}</text>
          </box>
        ) : null}
      </box>

      <scrollbox
        flexGrow={1}
        marginTop={1}
        border
        borderColor={DIM}
        paddingLeft={1}
        paddingRight={1}
      >
        {mode === 'help' ? (
          HELP.map((l, i) => (
            <box key={i} flexDirection="row" flexShrink={0}>
              {l.segs.filter((sg) => sg.t).length ? (
                l.segs
                  .filter((sg) => sg.t)
                  .map((sg, j) => (
                    <text key={j} flexShrink={0} fg={sg.dim ? DIM : sg.color}>
                      {sg.t}
                    </text>
                  ))
              ) : (
                <text> </text>
              )}
            </box>
          ))
        ) : current ? (
          lines.map((l, i) =>
            // A line with no content would lay out at zero height, so a blank
            // separator has to carry a space to occupy its row.
            l.segs.every((sg) => !sg.t) ? (
              <text key={i}> </text>
            ) : (
              // One <text> PER SEGMENT, in a row, rather than spans inside a
              // single <text>. Selection is per renderable: with spans, dragging
              // over a value also took the `labels ` / `assign ` / `repro `
              // prefix in front of it, so what landed on the clipboard was never
              // quite the thing that was highlighted. Separate elements make the
              // label and the value independently selectable.
              <box
                key={i}
                flexDirection="row"
                flexShrink={0}
                onMouseDown={
                  l.action === 'copy-comment' ? copyComment : undefined
                }
              >
                {l.segs
                  .filter((sg) => sg.t)
                  .map((sg, j) => (
                    // flexShrink={0} per segment. A line is many flex children
                    // now that each is separately selectable, so an overflowing
                    // row shrinks EVERY one of them — shaving the trailing space
                    // off `#123 ` and the `s` off `labels`. Pinning them makes a
                    // long line clip at the pane edge, as it did when the whole
                    // line was a single <text>, instead of silently losing
                    // characters spread across the row.
                    <text key={j} flexShrink={0} fg={sg.dim ? DIM : sg.color}>
                      {sg.t}
                    </text>
                  ))}
              </box>
            )
          )
        ) : (
          <text fg={DIM}>nothing selected</text>
        )}
      </scrollbox>

      {mode === 'comment' ? (
        <box flexDirection="column" paddingLeft={1} flexShrink={0}>
          <box width="100%" flexShrink={0}>
            <text fg="magenta">
              {'note to agent — enter saves, shift-enter newline, esc cancels'.padEnd(
                size.cols - 1
              )}
            </text>
          </box>
          {/*
            TextareaRenderable owns the whole field: text, caret, selection,
            word motions, undo/redo, wrapping, scrolling and bracketed PASTE.
            All of that used to be hand-rolled here, and the hand-rolled version
            silently dropped pasted text and reversed fast input.

            `focused` matters — it is what routes keys here instead of to the
            list handler, so `a`/`x`/`q` are ordinary characters while a note is
            open rather than commands.
          */}
          <textarea
            focused
            keyBindings={NOTE_KEYS}
            height={6}
            wrapMode="word"
            showCursor
            onSubmit={(_e: unknown, ta?: { plainText?: string }) => {
              const text = (
                ta?.plainText ??
                noteRef.current?.plainText ??
                ''
              ).trim();
              if (text) {
                setStatus('changes-requested', text, commentTargetRef.current);
              }
              setMode('list');
              drainReload();
            }}
            ref={noteRef}
          />
        </box>
      ) : (
        <box paddingLeft={1} flexShrink={0}>
          <text fg={DIM}>
            {mode === 'help' ? (
              <span>esc closes</span>
            ) : (
              <span>
                <span fg="green">a</span> approve · <span fg="red">x</span>{' '}
                reject · <span fg="magenta">c</span> comment ·{' '}
                <span fg="cyan">?</span> keys
              </span>
            )}
          </text>
        </box>
      )}

      {flash.text && mode === 'list' ? (
        <box paddingLeft={1} flexShrink={0}>
          <text fg={DIM}>{flash.text.padEnd(size.cols - 1)}</text>
        </box>
      ) : null}
    </box>
  );
}

function truncate(s: string, n: number) {
  return s && s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/** What is waiting once the screen is gone — the alt buffer took the view with it. */
function summarize() {
  const counts: Record<string, number> = {};
  for (const r of triage.listRecords()) {
    counts[r.front.status] = (counts[r.front.status] || 0) + 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (!total) return;
  const parts = Object.entries(counts).map(([k, n]) => `${n} ${k}`);
  process.stdout.write(`${total} staged: ${parts.join(', ')}\n`);
  if (counts.approved) {
    process.stdout.write(
      'run `.claude/tools/triage apply` to apply the approved ones\n'
    );
  }
  if (counts['changes-requested']) {
    process.stdout.write(
      '`.claude/tools/triage feedback` shows what you asked to change\n'
    );
  }
}

// The renderer owns the alternate screen, the mouse and the render loop; the
// summary prints from quit(), after destroy() has handed the terminal back.
createRoot(renderer).render(<App />);

// A pane killed from outside does not run exit handlers on its own, and would
// otherwise leave the terminal in the alternate buffer with no way back.
for (const sig of ['SIGTERM', 'SIGHUP'] as const) {
  process.on(sig, () => {
    for (const fn of cleanups.splice(0)) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
    renderer.destroy();
    process.exit(130);
  });
}
