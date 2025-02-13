//@ts-check
/**
 * @type {Array<[string, number]>}
 */
const timings = [];
const { dirname } = require('path');
const labelReplacers = [
  (l) => l.replace(dirname(dirname(require.resolve('nx'))), 'nx'),
];

const [filename] = process.argv.slice(2);

const child = require('child_process').fork(
  require.resolve('nx'),
  ['show', 'projects'],
  {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    env: {
      ...process.env,
      NX_DAEMON: 'false',
      NX_PERF_LOGGING: 'true',
    },
  },
);

child.stdout?.on('data', (data) => {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    const regex = /Time for '(?<label>.*)' (?<duration>[\d,.]+)/;
    const match = line.match(regex);
    if (match) {
      const { label, duration } = match.groups;
      const normalizedLabel = labelReplacers.reduce(
        (l, replacer) => replacer(l),
        label,
      );
      console.log('label:', normalizedLabel, 'duration:', duration);
      timings.push([normalizedLabel, parseFloat(duration)]);
    }
  }
});

process.on('beforeExit', () => {
  const maxDuration = Math.max(...timings.map(([, duration]) => duration));
  require('fs').writeFileSync(
    filename ?? 'timings.csv',
    'name,duration,ratio\n' +
      timings
        .sort((a, b) => b[1] - a[1])
        .map(
          ([name, duration]) =>
            `${name},${duration},${((duration / maxDuration) * 100).toFixed(2)}%`,
        )
        .join('\n'),
  );
});
