const mockPrompt = jest.fn();
jest.mock('enquirer', () => ({
  prompt: (...args: any[]) => mockPrompt(...args),
}));

import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ensureAnalyticsPreferenceSet } from './analytics-prompt';
import * as isCi from './is-ci';
import * as fileUtils from './fileutils';
import * as writeFormattedModule from './write-formatted-json-file';
import * as nxJson from '../config/nx-json';
import * as outputModule from './output';

describe('analytics-prompt', () => {
  let originalStdinIsTTY: boolean | undefined;
  let originalStdoutIsTTY: boolean | undefined;

  let mockIsCI = jest.spyOn(isCi, 'isCI');
  let mockReadNxJson = jest.spyOn(nxJson, 'readNxJson');
  let mockReadJsonFile = jest.spyOn(fileUtils, 'readJsonFile');
  let mockWriteFormattedJsonFile = jest
    .spyOn(writeFormattedModule, 'writeFormattedJsonFile')
    .mockResolvedValue(undefined);
  let mockOutputLog = jest.spyOn(outputModule.output, 'log');
  let mockOutputSuccess = jest.spyOn(outputModule.output, 'success');

  beforeEach(() => {
    jest.resetAllMocks();

    // Prevent output from writing to stdout during tests
    mockOutputLog.mockImplementation(() => {});
    mockOutputSuccess.mockImplementation(() => {});

    // Save original TTY values
    originalStdinIsTTY = process.stdin.isTTY;
    originalStdoutIsTTY = process.stdout.isTTY;
  });

  afterEach(() => {
    // Restore TTY values
    process.stdin.isTTY = originalStdinIsTTY;
    process.stdout.isTTY = originalStdoutIsTTY;
  });

  describe('ensureAnalyticsPreferenceSet', () => {
    it('should skip prompting in CI environments', async () => {
      mockIsCI.mockReturnValue(true);

      await ensureAnalyticsPreferenceSet();

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(mockWriteFormattedJsonFile).not.toHaveBeenCalled();
    });

    it('should skip prompting in non-interactive terminals', async () => {
      mockIsCI.mockReturnValue(false);
      Object.defineProperty(process.stdin, 'isTTY', {
        value: false,
        configurable: true,
      });

      await ensureAnalyticsPreferenceSet();

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(mockWriteFormattedJsonFile).not.toHaveBeenCalled();
    });

    it('should skip prompting if analytics is already true', async () => {
      mockIsCI.mockReturnValue(false);
      process.stdin.isTTY = true;
      process.stdout.isTTY = true;
      mockReadNxJson.mockReturnValue({ analytics: true });

      await ensureAnalyticsPreferenceSet();

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(mockWriteFormattedJsonFile).not.toHaveBeenCalled();
    });

    it('should skip prompting if analytics is already false', async () => {
      mockIsCI.mockReturnValue(false);
      process.stdin.isTTY = true;
      process.stdout.isTTY = true;

      mockReadNxJson.mockReturnValue({ analytics: false });

      await ensureAnalyticsPreferenceSet();

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(mockWriteFormattedJsonFile).not.toHaveBeenCalled();
    });

    it('should prompt and save true when user accepts', async () => {
      mockIsCI.mockReturnValue(false);
      process.stdin.isTTY = true;
      process.stdout.isTTY = true;

      mockReadNxJson.mockReturnValue({});
      mockReadJsonFile.mockReturnValue({});
      mockPrompt.mockResolvedValue({ enableAnalytics: true });

      await ensureAnalyticsPreferenceSet();

      expect(mockPrompt).toHaveBeenCalled();
      expect(mockWriteFormattedJsonFile).toHaveBeenCalledWith(
        expect.stringContaining('nx.json'),
        expect.objectContaining({ analytics: true })
      );
    });

    it('should prompt and save false when user declines', async () => {
      mockIsCI.mockReturnValue(false);
      process.stdin.isTTY = true;
      process.stdout.isTTY = true;
      mockReadNxJson.mockReturnValue({});
      mockReadJsonFile.mockReturnValue({});
      mockPrompt.mockResolvedValue({ enableAnalytics: false });

      await ensureAnalyticsPreferenceSet();

      expect(mockPrompt).toHaveBeenCalled();
      expect(mockWriteFormattedJsonFile).toHaveBeenCalledWith(
        expect.stringContaining('nx.json'),
        expect.objectContaining({ analytics: false })
      );
    });

    it('should save false when user cancels prompt (Ctrl+C)', async () => {
      mockIsCI.mockReturnValue(false);
      process.stdin.isTTY = true;
      process.stdout.isTTY = true;
      mockReadNxJson.mockReturnValue({});
      mockReadJsonFile.mockReturnValue({});
      mockPrompt.mockRejectedValue(new Error('User cancelled'));

      await ensureAnalyticsPreferenceSet();

      expect(mockPrompt).toHaveBeenCalled();
      expect(mockWriteFormattedJsonFile).toHaveBeenCalledWith(
        expect.stringContaining('nx.json'),
        expect.objectContaining({ analytics: false })
      );
    });
  });

  describe('ensureAnalyticsPreferenceSet with explicit root/interactive', () => {
    let root: string;

    beforeAll(() => {
      root = mkdtempSync(join(tmpdir(), 'nx-analytics-init-'));
      writeFileSync(join(root, 'nx.json'), '{}');
    });

    beforeEach(() => {
      mockReadJsonFile.mockReturnValue({});
    });

    it("returns 'unset' in CI without prompting", async () => {
      mockIsCI.mockReturnValue(true);

      expect(await ensureAnalyticsPreferenceSet(root, true)).toBe('unset');
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it("returns 'unset' when non-interactive without prompting", async () => {
      mockIsCI.mockReturnValue(false);

      expect(await ensureAnalyticsPreferenceSet(root, false)).toBe('unset');
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it("returns 'unset' when nx.json does not exist", async () => {
      mockIsCI.mockReturnValue(false);

      expect(
        await ensureAnalyticsPreferenceSet(join(root, 'missing'), true)
      ).toBe('unset');
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it("returns existing 'yes' without re-prompting", async () => {
      mockIsCI.mockReturnValue(false);
      mockReadNxJson.mockReturnValue({ analytics: true });

      expect(await ensureAnalyticsPreferenceSet(root, true)).toBe('yes');
      expect(mockPrompt).not.toHaveBeenCalled();
      expect(mockWriteFormattedJsonFile).not.toHaveBeenCalled();
    });

    it("returns existing 'no' without re-prompting", async () => {
      mockIsCI.mockReturnValue(false);
      mockReadNxJson.mockReturnValue({ analytics: false });

      expect(await ensureAnalyticsPreferenceSet(root, true)).toBe('no');
      expect(mockPrompt).not.toHaveBeenCalled();
      expect(mockWriteFormattedJsonFile).not.toHaveBeenCalled();
    });

    it("prompts, saves, and returns 'yes' when accepted", async () => {
      mockIsCI.mockReturnValue(false);
      mockReadNxJson.mockReturnValue({});
      mockPrompt.mockResolvedValue({ enableAnalytics: true });

      expect(await ensureAnalyticsPreferenceSet(root, true)).toBe('yes');
      expect(mockWriteFormattedJsonFile).toHaveBeenCalledWith(
        expect.stringContaining('nx.json'),
        expect.objectContaining({ analytics: true })
      );
    });

    it("prompts, saves, and returns 'no' when declined", async () => {
      mockIsCI.mockReturnValue(false);
      mockReadNxJson.mockReturnValue({});
      mockPrompt.mockResolvedValue({ enableAnalytics: false });

      expect(await ensureAnalyticsPreferenceSet(root, true)).toBe('no');
      expect(mockWriteFormattedJsonFile).toHaveBeenCalledWith(
        expect.stringContaining('nx.json'),
        expect.objectContaining({ analytics: false })
      );
    });
  });
});
