import {
  ensureAnalyticsPreferenceSet,
  getAnalyticsId,
} from './analytics-prompt';
import * as isCi from './is-ci';
import * as enquirer from 'enquirer';
import * as fileUtils from './fileutils';
import * as nxJson from '../config/nx-json';

// UUID v4 regex pattern
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

    it('should skip prompting if analytics is already set to a UUID', async () => {
      mockIsCI.mockReturnValue(false);
      process.stdin.isTTY = true;
      process.stdout.isTTY = true;
      mockReadNxJson.mockReturnValue({
        analytics: '550e8400-e29b-41d4-a716-446655440000',
      });

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

    it('should prompt and save a UUID when user accepts', async () => {
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
        expect.objectContaining({
          analytics: expect.stringMatching(UUID_PATTERN),
        })
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

  describe('getAnalyticsId', () => {
    it('should return the analytics UUID when set', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      mockReadNxJson.mockReturnValue({ analytics: uuid });

      expect(getAnalyticsId()).toBe(uuid);
    });

    it('should return false when analytics is disabled', () => {
      mockReadNxJson.mockReturnValue({ analytics: false });

      expect(getAnalyticsId()).toBe(false);
    });

    it('should return undefined when analytics is not set', () => {
      mockReadNxJson.mockReturnValue({});

      expect(getAnalyticsId()).toBeUndefined();
    });

    it('should return undefined when nxJson is empty', () => {
      mockReadNxJson.mockReturnValue(null);

      expect(getAnalyticsId()).toBeUndefined();
    });
  });
});
