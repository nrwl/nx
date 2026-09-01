/**
 * The approval surface for staged issue mutations.
 *
 * Reached through `triage review`, never run directly — the entry script owns
 * choosing the state directory and reporting a missing install. Record reading
 * and writing come from `../triage` rather than being reimplemented here: two
 * parsers for one file format is how a hand-edit starts meaning different things
 * to different verbs.
 *
 * This lives in its own directory because ink pulls in yoga-layout, which uses
 * top-level await and so cannot be transformed to CommonJS. The repo root
 * declares no module type, so the sibling package.json opts just this directory
 * into ESM, leaving the CommonJS `triage` entry script beside it untouched.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Text, render, useApp, useInput, useStdin, useStdout } from 'ink';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
// oxlint-disable-next-line @nx/enforce-module-boundaries -- the entry script is a plain file, not a project
const triage = require('../triage');

const STATUS_COLOR: Record<string, string> = {
  pending: 'yellow',
  approved: 'green',
  'changes-requested': 'magenta',
  rejected: 'red',
  applied: 'gray',
  failed: 'red',
};

type Record_ = { front: any; body: string; file: string };

function Detail({ record }: { record: Record_ }) {
  const { front, body } = record;
  const labels = [
    ...(front.add_labels || []).map((l: string) => `+${l}`),
    ...(front.remove_labels || []).map((l: string) => `-${l}`),
  ];
  const comment = triage.section(body, 'Comment');
  const rationale = triage.section(body, 'Rationale');
  const feedback = triage.section(body, 'Feedback');

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>
        #{front.issue} <Text color="cyan">{front.title}</Text>
      </Text>

      {labels.length > 0 && (
        <Text>
          <Text dimColor>labels </Text>
          {labels.map((l: string, i: number) => (
            <Text key={l} color={l.startsWith('+') ? 'green' : 'red'}>
              {i ? '  ' : ''}
              {l}
            </Text>
          ))}
        </Text>
      )}
      {front.assign ? (
        <Text>
          <Text dimColor>assign </Text>@{front.assign}
        </Text>
      ) : null}
      {front.linked_pr ? (
        <Text>
          <Text dimColor>PR </Text>
          <Text color="yellow">#{front.linked_pr} already targets this</Text>
        </Text>
      ) : null}
      {front.close_reason ? (
        <Text>
          <Text dimColor>close </Text>
          <Text color="red" bold>
            CLOSES this issue as "{front.close_reason}"
          </Text>
        </Text>
      ) : null}
      {front.repro ? (
        <Text>
          <Text dimColor>repro </Text>
          {front.repro}
        </Text>
      ) : null}

      {comment && comment !== '_none_' ? (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>comment to post</Text>
          <Box paddingLeft={2}>
            <Text wrap="wrap">{comment}</Text>
          </Box>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text dimColor>no comment</Text>
        </Box>
      )}

      {rationale && rationale !== '_none given_' ? (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>why</Text>
          <Box paddingLeft={2}>
            <Text wrap="wrap" dimColor>
              {rationale}
            </Text>
          </Box>
        </Box>
      ) : null}

      {feedback ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color="magenta">your note back to the agent</Text>
          <Box paddingLeft={2}>
            <Text wrap="wrap" color="magenta">
              {feedback}
            </Text>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}

function App() {
  const { exit } = useApp();
  const { setRawMode, isRawModeSupported } = useStdin();
  const { stdout } = useStdout();
  const [records, setRecords] = useState<Record_[]>(() => triage.listRecords());
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<'list' | 'comment'>('list');
  const [draft, setDraft] = useState('');
  const [flash, setFlash] = useState('');
  const [pendingOnly, setPendingOnly] = useState(false);

  const visible = useMemo(
    () =>
      pendingOnly
        ? records.filter(
            (r) => r.front.status === 'pending' || r.front.status === 'failed'
          )
        : records,
    [records, pendingOnly]
  );
  const current = visible[Math.min(index, visible.length - 1)];

  const reload = useCallback(() => {
    setRecords(triage.listRecords());
  }, []);

  const setStatus = useCallback(
    (status: string, note?: string) => {
      if (!current) return;
      const { front, body } = triage.readRecord(current.front.issue);
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
    setRawMode(false);
    spawnSync(editor, [triage.recordPath(current.front.issue)], {
      stdio: 'inherit',
    });
    setRawMode(true);
    stdout.write('\x1b[2J\x1b[H');
    setFlash(`reloaded #${current.front.issue} from disk`);
    reload();
  }, [current, reload, setRawMode, stdout]);

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

  // Without a TTY, enabling raw mode throws from inside ink. The entry script
  // guards this too; this keeps a direct `tsx index.tsx` from exploding.
  useInput(
    (input, key) => {
      if (mode === 'comment') {
        if (key.escape) {
          setMode('list');
          setDraft('');
        } else if (key.return) {
          if (draft.trim()) setStatus('changes-requested', draft.trim());
          setMode('list');
          setDraft('');
        } else if (key.backspace || key.delete) {
          setDraft((d) => d.slice(0, -1));
        } else if (input && !key.ctrl && !key.meta) {
          setDraft((d) => d + input);
        }
        return;
      }

      if (input === 'q' || (key.ctrl && input === 'c')) exit();
      else if (input === 'j' || key.downArrow)
        setIndex((i) => Math.min(i + 1, visible.length - 1));
      else if (input === 'k' || key.upArrow)
        setIndex((i) => Math.max(i - 1, 0));
      else if (input === 'a') setStatus('approved');
      else if (input === 'x') setStatus('rejected');
      else if (input === 'u') setStatus('pending');
      else if (input === 'c') {
        setMode('comment');
        setDraft('');
      } else if (input === 'e') openEditor();
      else if (input === 'o') openInBrowser();
      else if (input === 'r') {
        reload();
        setFlash('reloaded');
      } else if (input === 'f') {
        setPendingOnly((v) => !v);
        setIndex(0);
      }
      // Boolean(), not the raw value: process.stdin.isTTY is `undefined` rather
      // than false without a TTY, and ink tests `isActive === false` strictly, so
      // an undefined here switches raw mode on and throws.
    },
    { isActive: Boolean(isRawModeSupported) }
  );

  // No TTY means no keys will ever arrive, so render one static snapshot and
  // leave rather than idling forever on a stdin that can never answer.
  useEffect(() => {
    if (!isRawModeSupported) exit();
  }, [isRawModeSupported, exit]);

  const counts = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.front.status] = (acc[r.front.status] || 0) + 1;
    return acc;
  }, {});

  if (!records.length) {
    return (
      <Box padding={1}>
        <Text dimColor>
          Nothing staged. The agent writes records with `triage stage`.
        </Text>
      </Box>
    );
  }

  // Keep the selected row on screen without scrolling the whole terminal.
  const WINDOW = 8;
  const start = Math.max(
    0,
    Math.min(index - Math.floor(WINDOW / 2), visible.length - WINDOW)
  );
  const rows = visible.slice(Math.max(0, start), Math.max(0, start) + WINDOW);

  return (
    <Box flexDirection="column">
      <Box paddingX={1}>
        <Text bold>triage </Text>
        <Text dimColor>
          {Object.entries(counts)
            .map(([s, n]) => `${n} ${s}`)
            .join(', ')}
          {pendingOnly ? '  (showing unsettled only)' : ''}
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {rows.map((r) => {
          const selected = r === current;
          return (
            <Text key={r.front.issue}>
              <Text color="cyan">{selected ? ' > ' : '   '}</Text>
              <Text color={STATUS_COLOR[r.front.status] || 'white'}>
                {String(r.front.status).padEnd(18)}
              </Text>
              {r.front.close_reason ? (
                <Text color="red" bold>
                  {'CLOSE '}
                </Text>
              ) : null}
              <Text bold={selected}>
                #{r.front.issue}{' '}
                {truncate(r.front.title, r.front.close_reason ? 46 : 52)}
              </Text>
            </Text>
          );
        })}
        {visible.length > WINDOW && (
          <Text dimColor>
            {'   '}
            {visible.length - rows.length} more
          </Text>
        )}
      </Box>

      <Box
        borderStyle="round"
        borderColor="gray"
        flexDirection="column"
        marginTop={1}
      >
        {current ? (
          <Detail record={current} />
        ) : (
          <Text dimColor>nothing selected</Text>
        )}
      </Box>

      {mode === 'comment' ? (
        <Box paddingX={1}>
          <Text color="magenta">note to agent: </Text>
          <Text>{draft}</Text>
          <Text color="magenta">▏</Text>
        </Box>
      ) : (
        <Box paddingX={1}>
          <Text dimColor>
            j/k move · <Text color="green">a</Text> approve ·{' '}
            <Text color="red">x</Text> reject · <Text color="magenta">c</Text>{' '}
            comment · <Text color="cyan">o</Text> open · e edit · u unset · f
            filter · r reload · q quit
          </Text>
        </Box>
      )}

      {flash && mode === 'list' ? (
        <Box paddingX={1}>
          <Text dimColor>{flash}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

function truncate(s: string, n: number) {
  return s && s.length > n ? s.slice(0, n - 1) + '…' : s;
}

render(<App />);
