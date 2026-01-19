import { ensureAnalyticsPreferenceSet } from './analytics-prompt';
import * as isCi from './is-ci';
import * as enquirer from 'enquirer';
import * as fileUtils from './fileutils';
import * as nxJson from '../config/nx-json';

describe('analytics-prompt', () => {
  let originalStdinIsTTY: boolean | undefined;
  let originalStdoutIsTTY: boolean | undefined;

  let mockIsCI = jest.spyOn(isCi, 'isCI');
  let mockPrompt = jest.spyOn(enquirer, 'prompt');
  let mockReadNxJson = jest.spyOn(nxJson, 'readNxJson');
  let mockReadJsonFile = jest.spyOn(fileUtils, 'readJsonFile');
  let mockWriteJsonFile = jest.spyOn(fileUtils, 'writeJsonFile');

  beforeEach(() => {
    jest.resetAllMocks();

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
      expect(mockWriteJsonFile).not.toHaveBeenCalled();
    });

    it('should skip prompting in non-interactive terminals', async () => {
      mockIsCI.mockReturnValue(false);
      Object.defineProperty(process.stdin, 'isTTY', {
        value: false,
        configurable: true,
      });

      await ensureAnalyticsPreferenceSet();

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(mockWriteJsonFile).not.toHaveBeenCalled();
    });

    it('should skip prompting if analytics is already set to true', async () => {
      mockIsCI.mockReturnValue(false);
      process.stdin.isTTY = true;
      process.stdout.isTTY = true;
      mockReadNxJson.mockReturnValue({ analytics: true });

      await ensureAnalyticsPreferenceSet();

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(mockWriteJsonFile).not.toHaveBeenCalled();
    });

    it('should skip prompting if analytics is already set to false', async () => {
      mockIsCI.mockReturnValue(false);
      process.stdin.isTTY = true;
      process.stdout.isTTY = true;

      mockReadNxJson.mockReturnValue({ analytics: false });

      await ensureAnalyticsPreferenceSet();

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(mockWriteJsonFile).not.toHaveBeenCalled();
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
      expect(mockWriteJsonFile).toHaveBeenCalledWith(
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
      expect(mockWriteJsonFile).toHaveBeenCalledWith(
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
      expect(mockWriteJsonFile).toHaveBeenCalledWith(
        expect.stringContaining('nx.json'),
        expect.objectContaining({ analytics: false })
      );
    });
  });
});
