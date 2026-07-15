import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  extractDigest,
  getBuildxCommand,
  getImageIdFilePath,
  getMetadataFilePath,
  isLocalOrTarExporter,
  parseBuildxVersion,
  readImageId,
  readMetadata,
  satisfiesBuildx,
} from './buildx';

describe('parseBuildxVersion', () => {
  it('parses a standard version string', () => {
    expect(
      parseBuildxVersion('github.com/docker/buildx v0.12.1 abc123')
    ).toEqual('0.12.1');
  });

  it('parses a short-sha dev build version', () => {
    expect(parseBuildxVersion('github.com/docker/buildx abc1234')).toEqual(
      'abc1234'
    );
  });

  it('throws when no version can be found', () => {
    expect(() => parseBuildxVersion('nonsense')).toThrow(
      /Cannot parse buildx version/
    );
  });
});

describe('satisfiesBuildx', () => {
  it('matches a semver range', () => {
    expect(satisfiesBuildx('0.12.1', '>=0.8.0')).toBe(true);
    expect(satisfiesBuildx('0.4.0', '>=0.8.0')).toBe(false);
  });

  it('treats a short sha as always satisfying (dev build)', () => {
    expect(satisfiesBuildx('abc1234', '>=0.8.0')).toBe(true);
  });
});

describe('getBuildxCommand', () => {
  it('wraps args under `docker buildx` when not standalone', () => {
    expect(getBuildxCommand(['build', '.'], false)).toEqual({
      command: 'docker',
      args: ['buildx', 'build', '.'],
    });
  });

  it('invokes the standalone `buildx` binary directly', () => {
    expect(getBuildxCommand(['build', '.'], true)).toEqual({
      command: 'buildx',
      args: ['build', '.'],
    });
  });
});

describe('isLocalOrTarExporter', () => {
  it('treats a bare path as local', () => {
    expect(isLocalOrTarExporter(['./out'])).toBe(true);
  });

  it('detects type=local', () => {
    expect(isLocalOrTarExporter(['type=local,dest=./out'])).toBe(true);
  });

  it('detects type=tar', () => {
    expect(isLocalOrTarExporter(['type=tar,dest=./out.tar'])).toBe(true);
  });

  it('returns false for type=registry', () => {
    expect(isLocalOrTarExporter(['type=registry'])).toBe(false);
  });

  it('returns false when there are no outputs', () => {
    expect(isLocalOrTarExporter([])).toBe(false);
  });
});

describe('image id / metadata file helpers', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-docker-buildx-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns undefined when the iidfile does not exist', () => {
    expect(readImageId(tempDir)).toBeUndefined();
  });

  it('reads a trimmed image id from the iidfile', () => {
    writeFileSync(getImageIdFilePath(tempDir), 'sha256:abc123\n');
    expect(readImageId(tempDir)).toEqual('sha256:abc123');
  });

  it('returns undefined for a metadata file containing the literal `null`', () => {
    writeFileSync(getMetadataFilePath(tempDir), 'null');
    expect(readMetadata(tempDir)).toBeUndefined();
  });

  it('reads metadata JSON content', () => {
    writeFileSync(
      getMetadataFilePath(tempDir),
      '{"containerimage.digest":"sha256:xyz"}'
    );
    expect(readMetadata(tempDir)).toEqual(
      '{"containerimage.digest":"sha256:xyz"}'
    );
  });

  it('confirms the file exists after writing (sanity check for the fixture)', () => {
    writeFileSync(getImageIdFilePath(tempDir), 'x');
    expect(existsSync(getImageIdFilePath(tempDir))).toBe(true);
  });
});

describe('extractDigest', () => {
  it('extracts the digest field from metadata JSON', () => {
    expect(extractDigest('{"containerimage.digest":"sha256:xyz"}')).toEqual(
      'sha256:xyz'
    );
  });

  it('returns undefined when metadata is undefined', () => {
    expect(extractDigest(undefined)).toBeUndefined();
  });

  it('returns undefined when the digest field is absent', () => {
    expect(extractDigest('{}')).toBeUndefined();
  });

  it('returns undefined for malformed JSON', () => {
    expect(extractDigest('not-json')).toBeUndefined();
  });
});
