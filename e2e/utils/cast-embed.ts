import { readFileSync } from 'fs';
import { gzipSync } from 'zlib';

// play-cast.mts parses these lines; keep the two in sync.
const BEGIN = '----- BEGIN NX E2E RECORDING';
const END = '----- END NX E2E RECORDING -----';
const MAX_EMBED_BYTES = 1024 * 1024;

/**
 * The recording as a gzip+base64 block for the task log, which is the only
 * thing CI agents send back. Over 1 MB, the earliest commands are dropped.
 */
export function embedCastForLog(filePath: string): string {
  const [header, ...events] = readFileSync(filePath, 'utf-8')
    .split('\n')
    .filter(Boolean);

  const commandStarts = events.flatMap((e, i) =>
    JSON.parse(e)[1] === 'm' ? [i] : []
  );
  let from = 0;
  let gzipped = gzipCast(header, events);
  for (const start of commandStarts) {
    if (gzipped.length <= MAX_EMBED_BYTES) break;
    from = start;
    gzipped = gzipCast(header, events.slice(from), from);
  }
  while (gzipped.length > MAX_EMBED_BYTES && from < events.length - 1) {
    from = Math.floor((from + events.length) / 2);
    gzipped = gzipCast(header, events.slice(from), from);
  }

  const base64 = gzipped.toString('base64').match(/.{1,76}/g) ?? [];
  const size = `${Math.ceil(gzipped.length / 1024)} KB`;
  const note = from > 0 ? `, first ${from} events dropped` : '';
  return [`${BEGIN} (gzip+base64, ${size}${note}) -----`, ...base64, END].join(
    '\n'
  );
}

function gzipCast(header: string, events: string[], dropped = 0): Buffer {
  const parsed = JSON.parse(header);
  if (dropped > 0) parsed.title = `${parsed.title ?? ''} (truncated)`;
  return gzipSync([JSON.stringify(parsed), ...events].join('\n') + '\n');
}
