import { logger } from '../../utils/logger';
import { output } from '../../utils/output';
import { MAX_GENERATOR_OUTPUT_BYTES } from './agentic/capture-generator-output';
import {
  DeferredOutputCollector,
  MigrateOutputSink,
  replayDeferredOutput,
  terminalOutput,
} from './deferred-output';

const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;
const stripAnsi = (s: string): string => s.replace(ANSI_RE, '');

function recordingSink(): MigrateOutputSink & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  return {
    calls,
    notice: (...args) => calls.push(['notice', ...args]),
    line: (...args) => calls.push(['line', ...args]),
    raw: (...args) => calls.push(['raw', ...args]),
  };
}

describe('deferred output', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('terminalOutput', () => {
    it('prints notices through output, lines through logger, raw chunks to stdout', () => {
      const log = vi.spyOn(output, 'log').mockImplementation(() => {});
      const warn = vi.spyOn(output, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(output, 'error').mockImplementation(() => {});
      const info = vi.spyOn(logger, 'info').mockImplementation(() => {});
      const write = vi
        .spyOn(process.stdout, 'write')
        .mockImplementation(() => true);

      terminalOutput.notice('log', { title: 'a' });
      terminalOutput.notice('warn', { title: 'b', bodyLines: ['x'] });
      terminalOutput.notice('error', { title: 'c' });
      terminalOutput.line('red', 'failed');
      terminalOutput.raw('chunk');

      expect(log).toHaveBeenCalledWith({ title: 'a' });
      expect(warn).toHaveBeenCalledWith({ title: 'b', bodyLines: ['x'] });
      expect(error).toHaveBeenCalledWith({ title: 'c' });
      expect(stripAnsi(info.mock.calls[0][0])).toBe('failed');
      expect(write).toHaveBeenCalledWith('chunk');
    });
  });

  describe('DeferredOutputCollector', () => {
    it('keeps the records in the order they were produced', () => {
      const collector = new DeferredOutputCollector();

      collector.notice('log', { title: 'Running install' });
      collector.raw('added 1 package\n');
      collector.notice('error', { title: 'peer conflict', bodyLines: ['1.'] });
      collector.line('dim', '- No changes to commit for m.');

      expect(collector.render('keep')).toEqual([
        { kind: 'notice', level: 'log', title: 'Running install' },
        { kind: 'raw', text: 'added 1 package' },
        {
          kind: 'notice',
          level: 'error',
          title: 'peer conflict',
          bodyLines: ['1.'],
        },
        { kind: 'line', color: 'dim', text: '- No changes to commit for m.' },
      ]);
    });

    it('joins chunks of one stream into lines, keeping a chunk-split line whole', () => {
      const collector = new DeferredOutputCollector();

      collector.raw('npm warn dep');
      collector.raw('recated foo\nnpm warn old\n');
      collector.raw('added');

      expect(collector.render('keep')).toEqual([
        { kind: 'raw', text: 'npm warn deprecated foo\nnpm warn old\nadded' },
      ]);
    });

    it('drops the package manager output on request, keeping the notices and lines', () => {
      const collector = new DeferredOutputCollector();
      collector.notice('log', { title: 'Running install' });
      collector.raw('added 1 package\n');
      collector.line('dim', '- Committed m.');

      expect(collector.render('drop')).toEqual([
        { kind: 'notice', level: 'log', title: 'Running install' },
        { kind: 'line', color: 'dim', text: '- Committed m.' },
      ]);
    });

    it('bounds the package manager output it keeps like generator output', () => {
      const collector = new DeferredOutputCollector();
      const lines = Array.from({ length: 400 }, (_, i) =>
        `line-${i}`.padEnd(99, '.')
      );
      for (const line of lines) collector.raw(`${line}\n`);

      const [record] = collector.render('keep');

      expect(record.kind).toBe('raw');
      const text = (record as { text: string }).text;
      expect(Buffer.byteLength(text)).toBeLessThanOrEqual(
        MAX_GENERATOR_OUTPUT_BYTES
      );
      expect(text.startsWith(lines[0])).toBe(true);
      expect(text.endsWith(lines[399])).toBe(true);
      expect(text).toContain('bytes of output omitted');
    });

    it('keeps the end of an overlong line however the chunks split it', () => {
      const text = (collector: DeferredOutputCollector) =>
        (collector.render('keep')[0] as { text: string }).text;
      const line =
        'HEAD:' + 'x'.repeat(MAX_GENERATOR_OUTPUT_BYTES - 9) + 'ERR_';
      const split = new DeferredOutputCollector();
      split.raw(line);
      split.raw('PNPM_');
      split.raw('NO_MATCHING_VERSION\n');
      const whole = new DeferredOutputCollector();
      whole.raw(`${line}PNPM_NO_MATCHING_VERSION\n`);

      const rendered = text(split);

      expect(rendered.startsWith('HEAD:')).toBe(true);
      expect(rendered.endsWith('ERR_PNPM_NO_MATCHING_VERSION')).toBe(true);
      expect(Buffer.byteLength(rendered)).toBeLessThanOrEqual(
        MAX_GENERATOR_OUTPUT_BYTES
      );
      expect(rendered).toBe(text(whole));
    });

    it('renders the same records twice', () => {
      const collector = new DeferredOutputCollector();
      collector.raw('partial');

      expect(collector.render('keep')).toEqual(collector.render('keep'));
    });

    it('accepts nothing once rendered, so a later chunk cannot land unrendered', () => {
      const collector = new DeferredOutputCollector();
      collector.raw('part');
      collector.render('keep');

      expect(() => collector.raw('ial\n')).toThrow('already rendered');
      expect(() => collector.line('dim', 'x')).toThrow('already rendered');
      expect(() => collector.notice('log', { title: 'x' })).toThrow(
        'already rendered'
      );
    });
  });

  describe('replayDeferredOutput', () => {
    it('replays every record through the sink, raw text with its final newline', () => {
      const collector = new DeferredOutputCollector();
      collector.notice('warn', {
        title: 'skipped',
        bodyLines: ['run install'],
      });
      collector.raw('added 1 package\n');
      collector.line('red', 'Could not commit');
      const sink = recordingSink();

      replayDeferredOutput(collector.render('keep'), sink);

      expect(sink.calls).toEqual([
        ['notice', 'warn', { title: 'skipped', bodyLines: ['run install'] }],
        ['raw', 'added 1 package\n'],
        ['line', 'red', 'Could not commit'],
      ]);
    });

    it('prints nothing for an install that produced no output', () => {
      const sink = recordingSink();

      replayDeferredOutput([{ kind: 'raw', text: '' }], sink);

      expect(sink.calls).toEqual([]);
    });

    it('replays to the terminal by default', () => {
      const info = vi.spyOn(logger, 'info').mockImplementation(() => {});

      replayDeferredOutput([{ kind: 'line', color: 'dim', text: 'quiet' }]);

      expect(stripAnsi(info.mock.calls[0][0])).toBe('quiet');
    });
  });
});
