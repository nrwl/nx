import { existsSync } from 'fs';
import { safeExecFileSync } from '@nx/devkit/internal';

import { detectMavenExecutable } from './detect-maven-executable';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
}));

jest.mock('@nx/devkit/internal', () => ({
  safeExecFileSync: jest.fn(),
}));

describe('detectMavenExecutable', () => {
  const originalPlatform = process.platform;

  function setPlatform(platform: string) {
    Object.defineProperty(process, 'platform', { value: platform });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    // Maven Daemon is never available in these tests, so detection
    // falls through to the wrapper / fallback branches.
    jest.mocked(safeExecFileSync).mockImplementation(() => {
      throw new Error('mvnd not found');
    });
  });

  afterEach(() => {
    setPlatform(originalPlatform);
  });

  it('should return a relative path to mvnw.cmd on Windows', () => {
    setPlatform('win32');
    jest.mocked(existsSync).mockReturnValue(true);

    // A bare 'mvnw.cmd' is not found by cmd.exe when
    // NoDefaultCurrentDirectoryInExePath is set, because the current
    // directory is then not searched. Like @nx/gradle's
    // '.\gradlew.bat', the wrapper must be returned as a relative path.
    expect(detectMavenExecutable('/workspace')).toBe('.\\mvnw.cmd');
  });

  it('should return ./mvnw on non-Windows platforms', () => {
    setPlatform('linux');
    jest.mocked(existsSync).mockReturnValue(true);

    expect(detectMavenExecutable('/workspace')).toBe('./mvnw');
  });

  it('should fall back to mvn when no wrapper exists on Windows', () => {
    setPlatform('win32');
    jest.mocked(existsSync).mockReturnValue(false);

    expect(detectMavenExecutable('/workspace')).toBe('mvn');
  });
});
