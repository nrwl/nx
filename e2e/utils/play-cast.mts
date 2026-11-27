// Replays an e2e recording in this terminal.
//   node e2e/utils/play-cast.mts <file.cast>
//   node e2e/utils/play-cast.mts --from-log <saved task log>
//   node e2e/utils/play-cast.mts --run <runId> --task <taskId>   (fetches the log from Nx Cloud)
// Options: --pick <n> (when a log holds several), --save <file.cast>, --speed <x>
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'from-log': { type: 'string' },
    run: { type: 'string' },
    task: { type: 'string' },
    pick: { type: 'string' },
    save: { type: 'string' },
    speed: { type: 'string', default: '1' },
  },
});

const cast = loadCast();
if (values.save) {
  writeFileSync(values.save, cast);
  console.log(`Saved ${values.save}`);
} else {
  await play(cast, Number(values.speed) || 1);
}

function loadCast(): string {
  if (positionals[0]) return readFileSync(positionals[0], 'utf-8');
  if (values['from-log']) {
    return pickFromLog(readFileSync(values['from-log'], 'utf-8'));
  }
  if (values.run && values.task) return pickFromLog(fetchTaskLog());
  console.error(
    readFileSync(new URL(import.meta.url), 'utf-8')
      .split('\n')
      .slice(0, 6)
      .join('\n')
  );
  process.exit(1);
}

function fetchTaskLog(): string {
  const query = `task=${encodeURIComponent(`${values.run}:${values.task}`)}`;
  const response = execFileSync(
    'pnpm',
    ['nx-cloud', 'api', `/nx-cloud/data/batch/v0/task-logs?${query}`],
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'] }
  );
  const item = JSON.parse(response.slice(response.indexOf('{'))).items[0];
  if (!item?.url) {
    console.error(`No log for ${values.task}: ${item?.error?.message}`);
    process.exit(1);
  }
  return execFileSync('sh', ['-c', 'curl -sf "$0" | tar -xzO', item.url], {
    encoding: 'utf-8',
    maxBuffer: 512 * 1024 * 1024,
  });
}

// Matches the block written by embedCastForLog in cast-embed.ts.
function pickFromLog(log: string): string {
  const text = log.replace(/\x1b\[[0-9;]*m/g, '');
  const blocks = [
    ...text.matchAll(
      /^----- BEGIN NX E2E RECORDING[^\n]*\n([A-Za-z0-9+/=\s]+?)\n----- END NX E2E RECORDING -----/gm
    ),
  ].map((m) =>
    gunzipSync(Buffer.from(m[1].replace(/\s+/g, ''), 'base64')).toString(
      'utf-8'
    )
  );
  if (blocks.length === 0) {
    console.error('No e2e recordings in this log.');
    process.exit(1);
  }
  const pick = values.pick ? Number(values.pick) : blocks.length === 1 ? 1 : 0;
  if (!blocks[pick - 1]) {
    console.log('Recordings in this log (choose one with --pick <n>):');
    blocks.forEach((b, i) =>
      console.log(`  ${i + 1}. ${JSON.parse(b.split('\n')[0]).title}`)
    );
    process.exit(pick ? 1 : 0);
  }
  return blocks[pick - 1];
}

async function play(cast: string, speed: number) {
  const [headerLine, ...eventLines] = cast.split('\n').filter(Boolean);
  const header = JSON.parse(headerLine);
  const idleLimit: number = header.idle_time_limit ?? Infinity;
  process.stdout.write(
    `\x1b[2m▶ ${header.title ?? ''} (${header.width}x${header.height})\x1b[0m\r\n`
  );
  let previous = 0;
  for (const line of eventLines) {
    const [time, code, data] = JSON.parse(line) as [number, string, string];
    const wait = Math.min(time - previous, idleLimit) / speed;
    previous = time;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait * 1000));
    if (code === 'o') process.stdout.write(data);
  }
  process.stdout.write('\x1b[0m\r\n\x1b[2m■ end of recording\x1b[0m\r\n');
}
