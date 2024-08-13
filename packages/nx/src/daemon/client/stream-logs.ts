import { PathOrFileDescriptor, createReadStream, openSync, readFile } from 'fs';
import { DAEMON_OUTPUT_LOG_FILE } from '../tmp-dir';

const NX_DAEMON_LOG_POLLING_INTERVAL = process.env
  .NX_DAEMON_LOG_POLLING_INTERVAL
  ? parseInt(process.env.NX_DAEMON_LOG_POLLING_INTERVAL)
  : 20;

let streaming = false;

export async function streamLogs(keepAlive = false) {
  // Prevents streaming multiple times
  if (streaming) {
    return;
  }
  streaming = true;

  let fd: PathOrFileDescriptor;
  let consumed = 0;
  let initial = true;

  const interval = setInterval(() => {
    // fd is cleared when the stream ends
    if (fd) {
      return; // previous interval hasn't finished yet
    }

    try {
      fd = openSync(DAEMON_OUTPUT_LOG_FILE, 'r');
    } catch {
      // The file doesn't exist yet
      return;
    }

    const stream = createReadStream(null, {
      fd,
      encoding: 'utf8',
      start: consumed,
    });

    stream.on('data', function (chunk) {
      consumed += chunk.length;
    });

    // the stream ends automatically when the end of the file is reached
    stream.on('end', function () {
      fd = null;
      initial = false;
    });

    // The first time we read the file, we don't want to print the whole file
    if (!initial) {
      stream.pipe(process.stdout);
    }
  }, NX_DAEMON_LOG_POLLING_INTERVAL);

  if (!keepAlive) {
    interval.unref();
  }
}
