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
/**
 * The record store, injectable so this renderer serves more than one queue.
 * `triage review` leaves TUI_STORE unset; `review review` points it at
 * `.claude/tools/review`, which exports the same surface with PR-review records
 * adapted to it. Duplicating 1400 lines of renderer to change where the rows come
 * from would have been the alternative.
 */
// oxlint-disable-next-line @nx/enforce-module-boundaries -- the entry script is a plain file, not a project
const triage = require(process.env.TUI_STORE || '../triage');

/**
 * Read-only mode. A store whose records are not approved from here (reviews are
 * posted by /review-pending-pr-reviews, which needs the draft body) turns the
 * mutating verbs off rather than letting a keypress write a status the apply path
 * will never honour.
 */
/**
 * A real glyph that prints as blank. An all-spaces line measures as EMPTY, and a
 * marker slot that measures empty changes size the moment it gains text — which
 * repainted the list one row lower for exactly the frame where an overflow marker
 * appeared, then corrected itself. Reserving the row is not enough; the row has to
 * contain something.
 */

/**
 * Extra fixed-width list columns a store can ask for, rendered between the status
 * and the kind marker. Triage exports none, so its rows are byte-identical to
 * before; the review store asks for verdict and author.
 */
const COLUMNS: { key: string; width: number }[] = triage.COLUMNS ?? [];

/** Statuses the store treats as done. Empty for triage, which keeps its own rule. */
const TERMINAL_STATUSES: string[] = triage.TERMINAL_STATUSES ?? [];

/**
 * Store-declared key bindings. Each shells back to the store's own script with
 * the selected record's number, so the decision the action makes stays testable
 * on the CLI instead of living in a renderer. Triage declares none.
 */
const ACTIONS: { key: string; cmd: string; label: string }[] =
  triage.ACTIONS ?? [];
const STORE_BIN = process.env.TUI_STORE || '';

/**
 * Whether this store carries an agent-facing notes bus.
 *
 * A note is not a record mutation, so it is live even in READ_ONLY — but only a
 * store that has somewhere to put it can offer the key. The review store has no
 * events bus, so `n` is simply absent there rather than bound to a throw.
 */
const NOTES =
  typeof triage.appendNote === 'function' &&
  typeof triage.listNotes === 'function';

const READ_ONLY = process.env.TUI_READONLY === '1';
const QUEUE_LABEL = process.env.TUI_TITLE || 'triage';

/** One grey, so "secondary text" is a single decision rather than a prop that
 *  ink spelled `dimColor` and opentui spells as a colour. */
const DIM = '#8a8a8a';

/** Verdicts read at a glance or they are not worth a column. */
const VERDICT_COLOR: Record<string, string> = {
  lgtm: 'green',
  'needs-changes': 'yellow',
  blocked: 'red',
  failed: 'red',
  superseded: DIM,
  unnecessary: DIM,
};

/** A link under the pointer. Bright enough to read as "this does something". */
const HOVER = '#7dd3fc';

/**
 * A badge for who opened it, from GitHub's authorAssociation.
 *
 * Only two cases earn one. TEAM says "this needs no issue and can be merged by
 * its author"; NEW says "this person has never contributed here before", which
 * is the single fact most likely to change how a reply should be written. An
 * ordinary CONTRIBUTOR gets nothing — a badge on almost every row stops being a
 * signal.
 */
function authorBadge(assoc: string): { t: string; color: string } | null {
  const a = String(assoc || '').toUpperCase();
  if (a === 'OWNER' || a === 'MEMBER' || a === 'COLLABORATOR') {
    return { t: 'TEAM', color: 'green' };
  }
  if (a === 'FIRST_TIME_CONTRIBUTOR' || a === 'FIRST_TIMER') {
    return { t: 'NEW', color: 'magenta' };
  }
  return null;
}

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
/**
 * "Unsettled" is the store's word, not this file's. Triage's is `pending` plus
 * `failed`; the review store has eight live statuses and none of them is
 * `pending`, so the hardcoded pair filtered its list down to nothing. A store
 * that names its terminal statuses gets the complement instead.
 */
function visibleOf(records: Record_[], pendingOnly: boolean): Record_[] {
  if (!pendingOnly) return records;
  return TERMINAL_STATUSES.length
    ? records.filter((r) => !TERMINAL_STATUSES.includes(String(r.front.status)))
    : records.filter(
        (r) => r.front.status === 'pending' || r.front.status === 'failed'
      );
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

type Seg = {
  t: string;
  color?: string;
  dim?: boolean;
  bold?: boolean;
  /** Clicking this segment opens the URL. Per SEGMENT, not per line: a header
   *  is `#36393 <title>`, and only the number should be a link. */
  open?: string;
};
type Line = { segs: Seg[]; action?: 'copy-comment' };

const ln = (...segs: Seg[]): Line => ({ segs });
/** 0 for a file that is not there, so "did it change?" needs no separate exists check. */
const mtimeOf = (file: string): number => {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
};
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
  ...(process.env.TUI_READONLY === '1'
    ? [
        ln(
          { t: '  (read-only', color: '#8a8a8a' },
          { t: ' — this queue is applied elsewhere)' }
        ),
      ]
    : [
        ln({ t: '  a', color: 'green' }, { t: '        approve' }),
        ln({ t: '  x', color: 'red' }, { t: '        reject' }),
      ]),
  ln({ t: '  u', color: 'cyan' }, { t: '        back to pending' }),
  ln(
    { t: '  c', color: 'magenta' },
    { t: '        request changes — sends the record back with a note' }
  ),
  ...(NOTES
    ? [
        ln(
          { t: '  n', color: 'blue' },
          { t: '        note the agent something extra, deciding nothing' }
        ),
      ]
    : []),
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

/**
 * A URL for another issue or PR in the same repo, derived from this record's own
 * url rather than a hardcoded owner/name.
 *
 * `/issues/<n>` is used for both: GitHub redirects it to `/pull/<n>` when the
 * number is a pull request, so the link is right without having to know which
 * it is — and the linked reference frequently does not say.
 */
function siblingUrl(url: string, n: number | string): string {
  const base = String(url || '').replace(/\/(issues|pull)\/\d+.*$/, '');
  return base ? `${base}/issues/${n}` : '';
}

/**
 * Split prose into segments, marking URLs and `#123` references as links.
 *
 * Runs BEFORE wrapping, not after. wrapText hard-splits a token longer than the
 * pane, so linkifying wrapped lines would turn one URL into two fragments each
 * pointing at half an address. Wrapping the SEGMENTS instead carries the whole
 * URL onto both halves, so either one opens the right page.
 */
function linkify(text: string, selfUrl: string): Seg[] {
  const out: Seg[] = [];
  // Stop a URL at whitespace or a closing bracket — prose wraps them in
  // parentheses often enough that swallowing the `)` produces a dead link.
  const re = /(https?:\/\/[^\s)\]>]+)|(#\d+)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ t: text.slice(last, at) });
    let token = m[0];
    // Sentence punctuation is prose, not address.
    const trail = token.match(/[.,;:!?]+$/);
    const tail = trail ? trail[0] : '';
    if (tail) token = token.slice(0, -tail.length);
    const url = token.startsWith('#')
      ? siblingUrl(selfUrl, token.slice(1))
      : token;
    out.push(url ? { t: token, color: 'cyan', open: url } : { t: token });
    if (tail) out.push({ t: tail });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last) });
  return out.length ? out : [{ t: text }];
}

/**
 * Wrapped prose with live links. Paragraph breaks are preserved: wrapSegs knows
 * nothing about newlines, so each paragraph is wrapped on its own.
 */
function proseLines(
  text: string,
  width: number,
  indent: number,
  selfUrl: string,
  base: Partial<Seg> = {}
): Line[] {
  const pad = ' '.repeat(indent);
  const out: Line[] = [];
  for (const para of String(text).split('\n')) {
    if (!para.trim()) {
      out.push(blank);
      continue;
    }
    // `base` styles the prose — dim for the rationale, magenta for a note —
    // while links keep their own colour. A link that inherited `dim` would be
    // the least visible thing on the line.
    const segs = linkify(para, selfUrl).map((sg) =>
      sg.open ? sg : { ...base, ...sg }
    );
    out.push(...wrapSegs([{ ...base, t: pad }, ...segs], width, indent));
  }
  return out;
}

function detailLines(record: Record_, width: number, notes: string[]): Line[] {
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

  // A store whose records carry none of the triage sections (PR reviews name
  // theirs `## Review draft`) would otherwise render an empty pane. Show the
  // record's own prose instead of nothing.
  if (!comment && !rationale && !feedback) {
    // The whole record, not just its current attempt. `## Prior reviews` holds
    // every earlier round, and on #36870 the current draft is 84 lines of a
    // 2371-line record. The pane scrolls, so length is free.
    const draft = body.replace(/^#[^\n]*\n/, '').trim();
    return wrapText(draft || '(no body)', width).map((t) => ln({ t }));
  }

  const out: Line[] = [];
  // The title wraps rather than truncating: it is the one field where the tail
  // carries as much meaning as the head, and a hanging indent keeps the issue
  // number the only thing in the left margin. Same shape as `repro` below.
  const head = `#${front.issue} `;
  const titleLines = wrapText(String(front.title || ''), width, head.length);
  out.push(
    ln(
      { t: head, bold: true, open: front.url },
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
        {
          t: `#${String(front.linked_pr).replace(/^#/, '')}`,
          color: 'yellow',
          open: siblingUrl(
            front.url,
            String(front.linked_pr).replace(/^#/, '')
          ),
        },
        { t: ' already targets this', color: 'yellow' }
      )
    );
  }
  if (front.close_reason) {
    out.push(
      ln(
        { t: 'close ', dim: true },
        {
          t: `CLOSES this ${front.kind === 'pr' ? 'PR' : 'issue'} as "${front.close_reason}"`,
          color: 'red',
          bold: true,
        }
      )
    );
  }
  // PR-only rows. They come before `repro` because on a pull request they are
  // the evidence the whole judgement rests on: whether CI is green decides the
  // draft, and whether an issue is linked decides whether it should exist.
  if (front.author) {
    const badge = authorBadge(front.author_assoc);
    out.push(
      ln(
        { t: 'from   ', dim: true },
        { t: `@${front.author}` },
        ...(badge
          ? ([
              { t: '  ' },
              { t: badge.t, color: badge.color, bold: true },
            ] as Seg[])
          : []),
        ...(front.author_assoc
          ? ([
              { t: `  ${front.author_assoc.toLowerCase()}`, dim: true },
            ] as Seg[])
          : [])
      )
    );
  }

  if (front.kind === 'pr') {
    const ci = String(front.ci || 'unknown');
    const bad = /FAIL|ERROR|RED/i.test(ci);
    out.push(
      ln(
        { t: 'ci     ', dim: true },
        {
          t: ci,
          color: bad ? 'red' : /SUCCESS|PASS/i.test(ci) ? 'green' : 'yellow',
        }
      )
    );
    const linked = String(front.linked || '');
    out.push(
      ln(
        { t: 'linked ', dim: true },
        linked && linked !== 'none'
          ? {
              t: linked,
              color: 'cyan',
              open: /^#?\d+$/.test(linked.trim())
                ? siblingUrl(front.url, linked.trim().replace(/^#/, ''))
                : undefined,
            }
          : { t: 'no linked issue', color: 'yellow' }
      )
    );
    if (front.draft === 'true') {
      out.push(
        ln(
          { t: 'draft  ', dim: true },
          { t: 'CONVERTS this PR to a draft', color: 'yellow' }
        )
      );
    }
  }

  // Reproduction reads like the comment does — its own heading and an indented
  // body — because it is prose with paragraphs and commands in it, not a field.
  // It used to be a frontmatter scalar rendered with a hanging indent, which
  // flattened every paragraph break into one unbroken wall.
  const repro = triage.section(body, 'Reproduction');
  if (repro) {
    out.push(blank);
    out.push(ln({ t: 'reproduction', dim: true }));
    out.push(...proseLines(repro, width, 2, front.url));
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
    out.push(...proseLines(comment, width, 2, front.url));
  } else {
    out.push(blank);
    out.push(ln({ t: 'no comment', dim: true }));
  }

  if (rationale && rationale !== '_none given_') {
    out.push(blank);
    out.push(ln({ t: 'why', dim: true }));
    out.push(...proseLines(rationale, width, 2, front.url, { dim: true }));
  }

  if (feedback) {
    out.push(blank);
    out.push(ln({ t: 'changes you asked for', color: 'magenta' }));
    out.push(
      ...proseLines(feedback, width, 2, front.url, { color: 'magenta' })
    );
  }

  // Shown back because a note is otherwise write-only: the flash that confirms
  // it is gone in four seconds, and a reviewer who cannot see what they already
  // asked for writes it twice.
  if (notes.length) {
    out.push(blank);
    out.push(ln({ t: 'notes to the agent', color: 'blue' }));
    for (const note of notes) {
      out.push(...proseLines(note, width, 2, front.url, { color: 'blue' }));
    }
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

/**
 * Put the terminal back by hand, synchronously.
 *
 * `renderer.destroy()` schedules these writes, and an immediate `process.exit()`
 * beats the flush. Measured: quitting with `q` leaves cleanly, but SIGTERM —
 * which is what closing the pane sends — left ?1000, ?1002, ?1003 and ?1006 all
 * still enabled, so the caller's shell kept receiving mouse reports as garbage
 * input. Same shape as opentui #904 and #509.
 *
 * Idempotent, and safe to run after a clean teardown has already done it:
 * turning off a mode that is already off is a no-op.
 */
let restored = false;
function restoreTerminal(): void {
  if (restored) return;
  restored = true;
  try {
    process.stdout.write(
      '\x1b[?1003l\x1b[?1002l\x1b[?1000l\x1b[?1006l' + // mouse reporting
        '\x1b[?2004l' + // bracketed paste
        '\x1b[?1049l' + // alternate screen
        '\x1b[?25h' // cursor
    );
  } catch {
    /* nothing useful to do if stdout is already gone */
  }
}

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
  // Notes live on the events bus, not in the records, so they reload on their
  // own schedule rather than riding along with `listRecords`.
  const [notes, setNotes] = useState<{ issue: number; note: string }[]>(() =>
    NOTES ? triage.listNotes() : []
  );
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
  const [mode, setMode] = useState<'list' | 'comment' | 'note' | 'help'>(
    'list'
  );
  // The status line under the key hints. `seq` rides along so posting the same
  // message twice still restarts the dismiss timer — without it, React sees an
  // unchanged string, the effect never re-runs, and the second message would
  // inherit whatever was left of the first one's countdown.
  // Which link the pointer is over, keyed by URL. Without a hover state a link
  // is indistinguishable from the text beside it until you click and something
  // unexpected happens — the affordance has to be visible before the click.
  const [hoverUrl, setHoverUrl] = useState<string | null>(null);
  const [flash, setFlashState] = useState<{ text: string; seq: number }>({
    text: '',
    seq: 0,
  });
  // Defaults to the store's preference: a review list is mostly settled records
  // (23 dismissed and 20 posted against 17 live at the time of writing), so
  // opening on everything buries the work. Triage leaves it off as before.
  // The detail pane is windowed here rather than left to the scrollbox's own
  // scrolling, so the keyboard can drive it. opentui scrolls a scrollbox on the
  // mouse wheel only, and an uncapped body is otherwise reachable only by mouse.
  const [detailOffset, setDetailOffset] = useState(0);
  const [pendingOnly, setPendingOnly] = useState(
    triage.DEFAULT_PENDING_ONLY ?? false
  );
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
  // The issue the open text field is writing about, fixed when it opens. One
  // ref for both fields: only one of them is ever open.
  const fieldTargetRef = useRef<number | null>(null);
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
    if (NOTES) setNotes(triage.listNotes());
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
        if (modeRef.current === 'comment' || modeRef.current === 'note') {
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
            repro: triage.section(body, 'Reproduction'),
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

  /**
   * Leave the agent a note, touching nothing else.
   *
   * Deliberately not `setStatus`: the record keeps whatever the reviewer already
   * decided about it, including `approved`, so a note never delays an apply. It
   * is a message alongside the decision, not a decision.
   */
  const sendNote = useCallback(
    (text: string, issue?: number | null) => {
      const target = issue ?? (current ? Number(current.front.issue) : null);
      if (target == null) return;
      triage.appendNote(target, text);
      setNotes(triage.listNotes());
      // A note lives ONLY on the bus — unlike a status, it has no copy on disk
      // to fall back on — so a bus that could not be written means the note is
      // gone. Saying "noted" then would be a lie the reviewer acts on.
      const busError = triage.lastBusError?.();
      setFlash(
        busError
          ? `note NOT saved (${busError}) — the events bus is unwritable`
          : `noted on #${target}`
      );
    },
    [current, setFlash]
  );

  const openEditor = useCallback(() => {
    if (!current) return;
    const editor = process.env.VISUAL || process.env.EDITOR || 'vi';
    const issue = Number(current.front.issue);
    const file = triage.recordPath(issue);
    // Captured before the handoff: $EDITOR writes the file directly, so once it
    // returns the record can no longer say what it used to be.
    const before = String(current.front.status);
    const mtimeBefore = mtimeOf(file);
    // suspend() hands the terminal back — leaves the alternate buffer, restores
    // the cooked mode and stops the render loop — so the editor gets a clean
    // screen rather than fighting the renderer for it.
    renderer.suspend();
    spawnSync(editor, [file], { stdio: 'inherit' });
    renderer.resume();
    // An edit that changed the file bypassed writeRecord, so nothing has told
    // the agent's watch about it. Gated on mtime because opening $EDITOR and
    // quitting without saving is common, and it decides nothing.
    if (mtimeOf(file) !== mtimeBefore) triage.emitEdit?.(issue, before);
    setFlash(`reloaded #${issue} from disk`);
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

  const openUrl = useCallback(
    (url: string, label?: string) => {
      if (!url) {
        setFlash('no url for that');
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
      // spawn reports a missing opener asynchronously, so a try/catch would
      // miss it. Fall back to showing the URL, which is the useful thing anyway.
      child.on('error', () => setFlash(url));
      child.unref();
      setFlash(`opened ${label || url}`);
    },
    [setFlash]
  );

  const openInBrowser = useCallback(() => {
    if (!current) return;
    openUrl(current.front.url, `#${current.front.issue}`);
  }, [current, openUrl]);

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
    if (mode === 'comment' || mode === 'note') {
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
    else if (k.name === 'j' || k.name === 'down') { setDetailOffset(0); moveBy(1); }
    else if (k.name === 'k' || k.name === 'up') { setDetailOffset(0); moveBy(-1); }
    else if (k.ctrl && k.name === 'd')
      setDetailOffset((o) => Math.min(maxOffset, o + Math.max(1, Math.floor(contentH / 2))));
    else if (k.ctrl && k.name === 'u')
      setDetailOffset((o) => Math.max(0, o - Math.max(1, Math.floor(contentH / 2))));
    else if (k.name === 'pagedown') setDetailOffset((o) => Math.min(maxOffset, o + contentH));
    else if (k.name === 'pageup') setDetailOffset((o) => Math.max(0, o - contentH));
    // A record can run to a couple of thousand lines, so paging to the end is not
    // a reasonable way to reach it.
    else if (k.sequence === 'G' || k.name === 'end') setDetailOffset(maxOffset);
    else if (k.sequence === 'g' || k.name === 'home') setDetailOffset(0);
    else if (ACTIONS.some((a) => a.key === k.sequence) && current) {
      const act = ACTIONS.find((a) => a.key === k.sequence)!;
      // Detached and ignored: the action opens or focuses a tab elsewhere, and
      // this process owns the screen. Waiting on it would freeze the pane behind
      // whatever it started.
      spawn(STORE_BIN, [act.cmd, String(current.front.issue)], {
        detached: true,
        stdio: 'ignore',
      }).unref();
    } else if (k.name === 'a') {
      if (!READ_ONLY) setStatus('approved');
    } else if (k.name === 'x') {
      if (!READ_ONLY) setStatus('rejected');
    } else if (k.name === 'u') setStatus('pending');
    else if (k.name === 'c' && READ_ONLY) {
      /* no changes-requested path when the queue is applied elsewhere */
    } else if (k.name === 'c') {
      fieldTargetRef.current = currentIssueRef.current;
      setMode('comment');
    } else if (k.name === 'n' && NOTES && current) {
      fieldTargetRef.current = currentIssueRef.current;
      setMode('note');
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
          Nothing staged. The agent writes records with `{QUEUE_LABEL} stage`.
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

  // What is left for the detail pane once everything fixed is paid for: the
  // header, the margin above the list, the list, the margin above this pane, its
  // two border rows and the footer.
  const detailH = Math.max(3, size.rows - LIST_H - 6);
  // `height` on a scrollbox counts its borders, so the drawable area is two rows
  // smaller. Slicing by detailH fed it two more lines than it could draw and
  // silently clipped them, losing the last line of every long record.
  const contentH = Math.max(1, detailH - 2);

  // Solved in two passes because it is circular: whether a marker is needed
  // depends on how many issue rows fit, which depends on how many markers take
  // a line. Two passes settle it for any list length.
  //
  // `reserve` counts the markers that will ACTUALLY render, and `count` gives the
  // rows back accordingly, so the block is LIST_H tall wherever the cursor sits.
  // Reserving both slots unconditionally looks equivalent and is not: an empty
  // slot renders zero lines here — `height={1}` does not hold a row open for text
  // that measures empty — so the block came out a line short at each end and the
  // detail pane moved as you scrolled past it.
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
  const allLines = current
    ? detailLines(
        current,
        Math.max(24, size.cols - 6),
        notes
          .filter((n) => Number(n.issue) === Number(current.front.issue))
          .map((n) => n.note)
      )
    : [];
  const maxOffset = Math.max(0, allLines.length - contentH);
  const offset = Math.min(detailOffset, maxOffset);
  const lines = allLines.slice(offset, offset + contentH);

  return (
    <box flexDirection="column" width="100%" height="100%">
      <box paddingLeft={1}>
        <text>
          <b>{QUEUE_LABEL} </b>
          <span fg={DIM}>
            {truncate(
              Object.entries(counts)
                .map(([st, n]) => `${n} ${st}`)
                .join(', ') + (pendingOnly ? '  (showing unsettled only)' : ''),
              // One line, whatever the store's status vocabulary is. Reviews have
              // eight statuses to triage's six, and a wrapped header grows this box
              // and pushes the list down a row.
              Math.max(20, size.cols - QUEUE_LABEL.length - 3)
            )}
          </span>
        </text>
      </box>

      {/* flexShrink on the CONTAINER too: its children no longer shrink, so a
          shrinking parent would just let them spill over the pane below it. */}
      <box
        flexDirection="column"
        marginTop={1}
        flexShrink={0}
        // The wheel moves the SELECTION, not a separate scroll offset. The
        // window is derived from the selection, so a scroll that moved the view
        // without moving the cursor would leave the highlighted row off screen —
        // and the next `a` would act on something the reviewer cannot see.
        onMouseScroll={(e: {
          scroll?: {
            direction: 'up' | 'down' | 'left' | 'right';
            delta: number;
          };
        }) => {
          const sc = e.scroll;
          if (!sc || (sc.direction !== 'up' && sc.direction !== 'down')) return;
          const step = Math.max(1, Math.min(3, sc.delta || 1));
          moveBy(sc.direction === 'down' ? step : -step);
        }}
      >
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
          // `?? ''` rather than trusting the store: truncate returns its input
          // unchanged when falsy, so a record with no `title:` reached `.length`
          // and took the whole renderer down on that row.
          const title = truncate(
            r.front.title ?? '',
            r.front.close_reason ? 46 : 52
          );
          // Every row writes the FULL width. The renderer repaints the cells an
          // element covers, so a row that gets shorter than the one previously
          // drawn on that line leaves the tail of the old title behind. Padding
          // makes each row overwrite the whole line rather than a prefix of it.
          const used =
            3 +
            18 +
            COLUMNS.reduce((n, c) => n + c.width, 0) +
            3 + // the kind marker column
            5 + // the author badge column
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
              // Explicitly a row. It held one <text> before; now that the number
              // is its own element for the link, the default column direction
              // would stack the parts down the screen.
              flexDirection="row"
              onMouseDown={() => setSelectedIssue(Number(r.front.issue))}
            >
              <text flexShrink={0}>
                <span fg="cyan">{selected ? ' > ' : '   '}</span>
                <span fg={STATUS_COLOR[r.front.status] || 'white'}>
                  {String(r.front.status).padEnd(18)}
                </span>
                {COLUMNS.map((c) => (
                  <span
                    key={c.key}
                    fg={
                      c.key === 'verdict'
                        ? VERDICT_COLOR[r.front[c.key]] || DIM
                        : // A store marks a value as needing attention with ⟳. One
                          // generic rule beats a per-column colour map.
                          String(r.front[c.key] ?? '').includes('⟳')
                          ? 'yellow'
                          : DIM
                    }
                  >
                    {truncate(String(r.front[c.key] ?? ''), c.width - 1).padEnd(
                      c.width
                    )}
                  </span>
                ))}
                {/* Fixed width, like the badge: an issue row and a PR row have
                    to put their numbers in the same column. */}
                <span fg="cyan">{r.front.kind === 'pr' ? 'PR ' : '   '}</span>
                {r.front.close_reason ? <span fg="red">{'CLOSE '}</span> : null}
                {(() => {
                  // Padded to a fixed width so the numbers stay in a column
                  // whether or not a row has a badge — a ragged left edge on the
                  // issue numbers costs more than the badge gains.
                  const b = authorBadge(r.front.author_assoc);
                  return b ? (
                    <span fg={b.color}>{b.t.padEnd(5)}</span>
                  ) : (
                    <span>{'     '}</span>
                  );
                })()}
              </text>
              {/*
                The number is its own element so it can be a link while the rest
                of the row stays a select target. Both fire on a click here, and
                that is the intended behaviour: clicking an issue number selects
                it AND opens it, which is what you wanted from the click anyway.
              */}
              <text
                flexShrink={0}
                fg={hoverUrl === r.front.url ? HOVER : undefined}
                onMouseOver={() => setHoverUrl(r.front.url)}
                onMouseOut={() =>
                  setHoverUrl((h) => (h === r.front.url ? null : h))
                }
                onMouseDown={() => openUrl(r.front.url, `#${r.front.issue}`)}
              >
                {head}
              </text>
              <text flexShrink={0}>{title}</text>
              <text flexShrink={0}>{fill}</text>
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
        // Explicit height rather than flexGrow. Sized from the terminal, this pane
        // cannot grow with its content, so a long body scrolls inside it instead
        // of pushing the list above out of position. flexGrow made the pane's
        // height a function of how many children it held.
        height={detailH}
        minHeight={0}
        flexShrink={0}
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
                    <text
                      key={j}
                      flexShrink={0}
                      // Per-segment, so only the number is a link and the title
                      // beside it is not. A whole-line target would open the
                      // browser on any click in the pane.
                      fg={
                        sg.open && hoverUrl === sg.open
                          ? HOVER
                          : sg.dim
                            ? DIM
                            : sg.color
                      }
                      onMouseOver={
                        sg.open ? () => setHoverUrl(sg.open!) : undefined
                      }
                      onMouseOut={
                        sg.open
                          ? () => setHoverUrl((h) => (h === sg.open ? null : h))
                          : undefined
                      }
                      onMouseDown={
                        sg.open
                          ? () => openUrl(sg.open!, sg.t.trim())
                          : undefined
                      }
                    >
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

      {mode === 'comment' || mode === 'note' ? (
        <box flexDirection="column" paddingLeft={1} flexShrink={0}>
          <box width="100%" flexShrink={0}>
            {/*
              The two fields look the same and do different things, so the prompt
              has to say which one is open — one sends the record back for rework,
              the other decides nothing. A reviewer who reads the wrong one finds
              out by the status changing under them.
            */}
            <text fg={mode === 'note' ? 'blue' : 'magenta'}>
              {(mode === 'note'
                ? 'note to agent, no decision — enter sends, shift-enter newline, esc cancels'
                : 'request changes — enter sends it back, shift-enter newline, esc cancels'
              ).padEnd(size.cols - 1)}
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
                if (mode === 'note') sendNote(text, fieldTargetRef.current);
                else
                  setStatus('changes-requested', text, fieldTargetRef.current);
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
                {maxOffset > 0 ? (
                  <span fg={DIM}>
                    {`${offset + 1}-${Math.min(offset + contentH, allLines.length)}/${allLines.length} `}
                    <span fg="cyan">^d/^u</span>
                    {' scroll · '}
                    <span fg="cyan">g/G</span>
                    {' ends · '}
                  </span>
                ) : null}
                {ACTIONS.map((a) => (
                  <span key={a.key}>
                    <span fg="cyan">{a.key}</span>
                    {` ${a.label} · `}
                  </span>
                ))}
                {!READ_ONLY && (
                  <>
                    <span fg="green">a</span> approve · <span fg="red">x</span>{' '}
                    reject · <span fg="magenta">c</span> comment ·{' '}
                  </>
                )}
                {NOTES && (
                  <>
                    <span fg="blue">n</span> note ·{' '}
                  </>
                )}
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
      `run \`.claude/tools/${QUEUE_LABEL === 'triage' ? 'triage' : QUEUE_LABEL}\` apply to apply the approved ones\n`
    );
  }
  if (counts['changes-requested']) {
    process.stdout.write(
      '`.claude/tools/triage feedback` shows what you asked to change\n'
    );
  }
  const noteCount = NOTES ? triage.listNotes().length : 0;
  if (noteCount) {
    process.stdout.write(
      `\`.claude/tools/triage notes\` shows the ${noteCount} note${noteCount === 1 ? '' : 's'} you left\n`
    );
  }
}

// The renderer owns the alternate screen, the mouse and the render loop; the
// summary prints from quit(), after destroy() has handed the terminal back.
// A final guarantee. Any exit that skips the paths above — an uncaught throw,
// an explicit process.exit elsewhere — still gets the terminal back.
process.on('exit', restoreTerminal);

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
    // After destroy, because destroy is what enables them again on some paths,
    // and before exit, because exit does not wait for destroy's own writes.
    restoreTerminal();
    process.exit(130);
  });
}
