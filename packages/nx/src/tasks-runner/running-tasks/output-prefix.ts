import * as pc from 'picocolors';
import { EOL } from 'os';
import { Transform } from 'stream';

const colors = [
  pc.green,
  pc.greenBright,
  pc.blue,
  pc.blueBright,
  pc.cyan,
  pc.cyanBright,
  pc.yellow,
  pc.yellowBright,
  pc.magenta,
  pc.magentaBright,
];

export function getColor(projectName: string) {
  let code = 0;
  for (let i = 0; i < projectName.length; ++i) {
    code += projectName.charCodeAt(i);
  }
  const colorIndex = code % colors.length;

  return colors[colorIndex];
}

/**
 * Formats a chunk by splitting it into lines and optionally prepending a prefix.
 * Returns an array of formatted line strings (including EOL).
 */
export function formatPrefixedLines(
  chunk: string | Buffer,
  prefix?: string
): string[] {
  const lines = chunk.toString().split(/\r\n|[\n\v\f\r\x85\u2028\u2029]/g);
  const result: string[] = [];
  for (const line of lines) {
    if (line) {
      result.push(prefix ? prefix + ' ' + line + EOL : line + EOL);
    }
  }
  return result;
}

/**
 * Splits a chunk into lines, optionally prepends a prefix, and writes each
 * non-empty line to the given writable (defaults to `process.stdout`).
 */
export function writePrefixedLines(
  chunk: string | Buffer,
  prefix?: string,
  writable: NodeJS.WritableStream = process.stdout
) {
  for (const line of formatPrefixedLines(chunk, prefix)) {
    writable.write(line);
  }
}

export function addPrefixTransformer(prefix?: string) {
  return new Transform({
    transform(chunk, _encoding, callback) {
      for (const line of formatPrefixedLines(chunk, prefix)) {
        this.push(line);
      }
      callback();
    },
  });
}
