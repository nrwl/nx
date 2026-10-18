import { stripVTControlCharacters } from 'util';
import { Spinner } from './spinner';

vi.mock('./is-ci', () => ({ isCI: () => false }));

describe('Spinner', () => {
  let writes: string[];
  let originalIsTTY: boolean;
  let originalColumns: number;

  beforeEach(() => {
    writes = [];
    originalIsTTY = process.stderr.isTTY;
    originalColumns = process.stderr.columns;
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    process.stderr.isTTY = originalIsTTY;
    process.stderr.columns = originalColumns;
    vi.restoreAllMocks();
  });

  const output = () => stripVTControlCharacters(writes.join(''));

  describe('without a TTY', () => {
    beforeEach(() => {
      process.stderr.isTTY = false;
    });

    it('prints start, succeed, and fail as plain lines', () => {
      const spinner = new Spinner('Cloning').start();
      spinner.succeed('Cloned');
      spinner.start('Merging').fail('Merge failed');

      expect(spinner.isSpinning).toBe(false);
      expect(output()).toMatchInlineSnapshot(`
        "- Cloning
        ✔ Cloned
        - Merging
        ✖ Merge failed
        "
      `);
    });

    it('persists the current text when succeed has no text', () => {
      new Spinner('Opening Nx Cloud').start().succeed();

      expect(output()).toContain('✔ Opening Nx Cloud\n');
    });
  });

  describe('with a TTY', () => {
    beforeEach(() => {
      process.stderr.isTTY = true;
      process.stderr.columns = 10;
    });

    it('renders a frame and clears it on stop', () => {
      const spinner = new Spinner('Working').start();
      expect(spinner.isSpinning).toBe(true);
      expect(output()).toBe('⠋ Working');

      writes = [];
      spinner.stop();

      expect(spinner.isSpinning).toBe(false);
      expect(writes.join('')).toContain('\u001B[0K');
    });

    it('clears every wrapped row of long text', () => {
      const spinner = new Spinner('a'.repeat(25)).start();

      writes = [];
      spinner.stop();

      // "⠋ " plus 25 chars is 27 columns, which wraps to 3 rows at width 10.
      const cursorUps = writes.filter((w) => w === '\u001B[1A');
      expect(cursorUps).toHaveLength(2);
    });

    it('prints the prefix before the frame and the persisted line', () => {
      const spinner = new Spinner('Graph');
      spinner.prefixText = '[nx]';
      spinner.start().succeed('Graph ready');

      expect(output()).toContain('[nx] ⠋ Graph');
      expect(output()).toContain('[nx] ✔ Graph ready\n');
    });
  });
});
