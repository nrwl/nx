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
 * Splits a chunk into lines, optionally prepends a prefix, and writes each
 * non-empty line to the given writable (defaults to `process.stdout`).
 */
export function writePrefixedLines(
  chunk: string | Buffer,
  prefix?: string,
  writable: NodeJS.WritableStream = process.stdout
) {
  const lines = chunk.toString().split(/\r\n|[\n\v\f\r\x85\u2028\u2029]/g);
  for (const line of lines) {
    if (line) {
      writable.write(prefix ? prefix + ' ' + line + EOL : line + EOL);
    }
  }
}

export function addPrefixTransformer(prefix?: string) {
  return new Transform({
    transform(chunk, _encoding, callback) {
      writePrefixedLines(chunk, prefix, this);
      callback();
    },
  });
}
