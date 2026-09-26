import type { MockedFunction } from 'vitest';

vi.mock('../native', async () => ({
  ...(await vi.importActual('../native')),
  isAiAgent: vi.fn(() => false),
}));
vi.mock('../utils/is-sandbox', () => ({ isSandbox: vi.fn(() => false) }));

import { isAiAgent } from '../native';
import { isSandbox } from '../utils/is-sandbox';
import { agentConfigWriteBlockedLines } from './utils';

const mockIsAiAgent = isAiAgent as MockedFunction<typeof isAiAgent>;
const mockIsSandbox = isSandbox as MockedFunction<typeof isSandbox>;

const eacces = Object.assign(
  new Error("EACCES: permission denied, open '/repo/.claude/settings.json'"),
  { code: 'EACCES', path: '/repo/.claude/settings.json' }
);

describe('agentConfigWriteBlockedLines', () => {
  afterEach(() => {
    mockIsAiAgent.mockReset();
    mockIsSandbox.mockReset();
  });

  it.each([
    ['a sandbox', true, false],
    ['an agent', false, true],
  ])('explains the harness when there is %s', (_, sandbox, agent) => {
    mockIsSandbox.mockReturnValue(sandbox);
    mockIsAiAgent.mockReturnValue(agent);

    expect(agentConfigWriteBlockedLines(eacces).join('\n')).toContain(
      'Agent sandboxes protect their own settings files'
    );
  });

  it('does not blame a sandbox in a plain terminal', () => {
    // The errno alone does not identify the cause: a root-owned settings file
    // left by an earlier `sudo nx`, or a read-only checkout, reads identically
    // and needs the opposite remedy. Telling that user to rerun the command in
    // a regular terminal is telling them to do what they just did.
    mockIsSandbox.mockReturnValue(false);
    mockIsAiAgent.mockReturnValue(false);

    const lines = agentConfigWriteBlockedLines(eacces).join('\n');

    expect(lines).not.toContain('Agent sandboxes');
    expect(lines).toContain('ownership and mode');
  });

  it.each([true, false])(
    'keeps the underlying error message either way (sandboxed: %s)',
    (sandboxed: boolean) => {
      // The base behavior printed `e.message`, which is the only place the
      // errno and the real path survive.
      mockIsSandbox.mockReturnValue(sandboxed);
      mockIsAiAgent.mockReturnValue(false);

      expect(agentConfigWriteBlockedLines(eacces)[0]).toContain(
        "EACCES: permission denied, open '/repo/.claude/settings.json'"
      );
    }
  );
});
