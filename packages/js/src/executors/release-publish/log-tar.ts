// Adapted from https://github.com/npm/cli/blob/c736b622b8504b07f5a19f631ade42dd40063269/lib/utils/tar.js
import * as chalk from 'chalk';
import * as columnify from 'columnify';
import { formatBytes } from './format-bytes';

export const logTar = (tarball, opts = {}) => {
  // @ts-ignore
  const { unicode = true } = opts;
  console.log('');
  console.log(
    `${unicode ? '📦 ' : 'package:'} ${tarball.name}@${tarball.version}`
  );
  console.log(chalk.magenta('=== Tarball Contents ==='));
  if (tarball.files.length) {
    console.log('');
    const columnData = columnify(
      tarball.files
        .map((f) => {
          const bytes = formatBytes(f.size, false);
          return /^node_modules\//.test(f.path)
            ? null
            : { path: f.path, size: `${bytes}` };
        })
        .filter((f) => f),
      {
        include: ['size', 'path'],
        showHeaders: false,
      }
    );
    columnData.split('\n').forEach((line) => {
      console.log(line);
    });
  }
  if (tarball.bundled.length) {
    console.log(chalk.magenta('=== Bundled Dependencies ==='));
    tarball.bundled.forEach((name) => console.log('', name));
  }
  console.log(chalk.magenta('=== Tarball Details ==='));
  console.log(
    columnify(
      [
        { name: 'name:', value: tarball.name },
        { name: 'version:', value: tarball.version },
        tarball.filename && { name: 'filename:', value: tarball.filename },
        { name: 'package size:', value: formatBytes(tarball.size) },
        { name: 'unpacked size:', value: formatBytes(tarball.unpackedSize) },
        { name: 'shasum:', value: tarball.shasum },
        {
          name: 'integrity:',
          value:
            tarball.integrity.toString().slice(0, 20) +
            '[...]' +
            tarball.integrity.toString().slice(80),
        },
        tarball.bundled.length && {
          name: 'bundled deps:',
          value: tarball.bundled.length,
        },
        tarball.bundled.length && {
          name: 'bundled files:',
          value: tarball.entryCount - tarball.files.length,
        },
        tarball.bundled.length && {
          name: 'own files:',
          value: tarball.files.length,
        },
        { name: 'total files:', value: tarball.entryCount },
      ].filter((x) => x),
      {
        include: ['name', 'value'],
        showHeaders: false,
      }
    )
  );
  console.log('', '');
};
