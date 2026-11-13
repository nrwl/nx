export function hideCursor(stream: NodeJS.WriteStream = process.stderr) {
  if (stream.isTTY) {
    stream.write('\u001B[?25l');
  }
}

export function showCursor(stream: NodeJS.WriteStream = process.stderr) {
  if (stream.isTTY) {
    stream.write('\u001B[?25h');
  }
}
