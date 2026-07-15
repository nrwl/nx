import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  extractDigest,
  getImageIdFilePath,
  getPodmanCommand,
  isLocalOrTarExporter,
  parsePodmanVersion,
  readImageId,
  satisfiesPodman,
} from './podman';

describe('parsePodmanVersion', () => {
  it('parses a standard version string', () => {
    expect(parsePodmanVersion('podman version 4.9.3')).toEqual('4.9.3');
  });

  it('throws when no version can be found', () => {
    expect(() => parsePodmanVersion('nonsense')).toThrow(
      /Cannot parse podman version/
    );
  });
});

describe('satisfiesPodman', () => {
  it('matches a semver range', () => {
    expect(satisfiesPodman('4.9.3', '>=4.2.0')).toBe(true);
    expect(satisfiesPodman('3.0.0', '>=4.2.0')).toBe(false);
  });
});

describe('getPodmanCommand', () => {
  it('always uses the podman binary directly', () => {
    expect(getPodmanCommand(['build', '.'])).toEqual({
      command: 'podman',
      args: ['build', '.'],
    });
  });
});

describe('isLocalOrTarExporter', () => {
  it('detects type=tar', () => {
    expect(isLocalOrTarExporter(['type=tar,dest=./out.tar'])).toBe(true);
  });

  it('returns false for type=registry', () => {
    expect(isLocalOrTarExporter(['type=registry'])).toBe(false);
  });
});

describe('image id / metadata helpers', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-docker-podman-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('reads a trimmed image id from the iidfile', () => {
    writeFileSync(getImageIdFilePath(tempDir), 'sha256:abc123\n');
    expect(readImageId(tempDir)).toEqual('sha256:abc123');
  });

  it('extracts the digest field from metadata JSON', () => {
    expect(extractDigest('{"containerimage.digest":"sha256:xyz"}')).toEqual(
      'sha256:xyz'
    );
  });
});
