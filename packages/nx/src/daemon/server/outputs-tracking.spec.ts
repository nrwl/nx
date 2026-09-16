import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { EventType } from '../../native';
import { setWorkspaceRoot } from '../../utils/workspace-root';
import {
  _outputsHashesMatch,
  _recordOutputsHash,
  processFileChangesInOutputs,
} from './outputs-tracking';

// The tracker stats paths under the workspace root; point it at a scratch
// directory so the specs can write real files and set their mtimes.
const workspaceRoot = mkdtempSync(join(tmpdir(), 'nx-outputs-tracking-'));
beforeAll(() => setWorkspaceRoot(workspaceRoot));
afterAll(() => rmSync(workspaceRoot, { recursive: true, force: true }));

function setModified(path: string, time: number) {
  utimesSync(join(workspaceRoot, path), time / 1000, time / 1000);
}

describe('outputs tracking', () => {
  const now = new Date().getTime() + 10000;

  // Events are dated by the path's mtime, so the paths these cases name exist
  // and were written after the record.
  beforeEach(() => {
    mkdirSync(join(workspaceRoot, 'dist/app/app1'), { recursive: true });
    writeFileSync(join(workspaceRoot, 'dist/app/app1/child'), 'built');
    for (const path of ['dist/app', 'dist/app/app1', 'dist/app/app1/child']) {
      setModified(path, now);
    }
  });

  afterEach(() => {
    rmSync(join(workspaceRoot, 'dist'), { recursive: true, force: true });
  });

  it('should record hashes', () => {
    _recordOutputsHash(['dist/app/app1'], '123');
    expect(_outputsHashesMatch(['dist/app/app1'], '123')).toBeTruthy();
    expect(_outputsHashesMatch(['dist/app/app1'], '1234')).toBeFalsy();
    expect(
      _outputsHashesMatch(['dist/app/app1', 'dist/app/app1/different'], '1234')
    ).toBeFalsy();
  });

  it('should invalidate output when it is exact match', () => {
    _recordOutputsHash(['dist/app/app1'], '123');
    processFileChangesInOutputs([
      { path: 'dist/app/app1', type: EventType.update },
    ]);
    expect(_outputsHashesMatch(['dist/app/app1'], '123')).toBe(false);
  });

  it('should invalidate output when it is a child', () => {
    _recordOutputsHash(['dist/app/app1'], '123');
    processFileChangesInOutputs([
      { path: 'dist/app/app1/child', type: EventType.update },
    ]);
    expect(_outputsHashesMatch(['dist/app/app1'], '123')).toBe(false);
  });

  it('should invalidate output when it is a parent', () => {
    _recordOutputsHash(['dist/app/app1'], '123');
    processFileChangesInOutputs([{ path: 'dist/app', type: EventType.update }]);
    expect(_outputsHashesMatch(['dist/app/app1'], '123')).toBe(false);
  });

  it('should not invalidate anything when no match', () => {
    _recordOutputsHash(['dist/app/app1'], '123');
    processFileChangesInOutputs([
      { path: 'dist/app2', type: EventType.update },
    ]);
    expect(_outputsHashesMatch(['dist/app/app1'], '123')).toBe(true);
  });
});

describe('outputs tracking dates change events by mtime', () => {
  let tempDir: string;
  let output: string;
  let file: string;

  beforeEach(() => {
    tempDir = `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    output = `${tempDir}/app1`;
    file = `${output}/main.js`;
    mkdirSync(join(workspaceRoot, output), { recursive: true });
    writeFileSync(join(workspaceRoot, file), 'built');
  });

  afterEach(() => {
    rmSync(join(workspaceRoot, tempDir), { recursive: true, force: true });
  });

  it('should keep the hash when an event describes a write made before the hash was recorded', () => {
    setModified(file, Date.now() - 10000);
    _recordOutputsHash([output], '123');
    processFileChangesInOutputs([{ path: file, type: EventType.create }]);
    expect(_outputsHashesMatch([output], '123')).toBe(true);
  });

  it('should keep the hash when an event for a parent directory predates the record', () => {
    setModified(tempDir, Date.now() - 10000);
    _recordOutputsHash([output], '123');
    processFileChangesInOutputs([{ path: tempDir, type: EventType.update }]);
    expect(_outputsHashesMatch([output], '123')).toBe(true);
  });

  it('should invalidate the hash when the file was modified after the hash was recorded', () => {
    _recordOutputsHash([output], '123');
    setModified(file, Date.now() + 5000);
    processFileChangesInOutputs([{ path: file, type: EventType.update }]);
    expect(_outputsHashesMatch([output], '123')).toBe(false);
  });

  it('should invalidate the hash when a parent directory was modified after the hash was recorded', () => {
    _recordOutputsHash([output], '123');
    setModified(tempDir, Date.now() + 5000);
    processFileChangesInOutputs([{ path: tempDir, type: EventType.update }]);
    expect(_outputsHashesMatch([output], '123')).toBe(false);
  });

  it('should keep the hash when a delete describes a file removed before the hash was recorded', () => {
    // A restore replacing the outputs removes superseded files first; the
    // deleted path is dated by its parent, which was written before the record.
    rmSync(join(workspaceRoot, file));
    setModified(output, Date.now() - 10000);
    _recordOutputsHash([output], '123');
    processFileChangesInOutputs([{ path: file, type: EventType.delete }]);
    expect(_outputsHashesMatch([output], '123')).toBe(true);
  });

  it('should invalidate the hash when the file was deleted after the hash was recorded', () => {
    _recordOutputsHash([output], '123');
    rmSync(join(workspaceRoot, file));
    setModified(output, Date.now() + 5000);
    processFileChangesInOutputs([{ path: file, type: EventType.delete }]);
    expect(_outputsHashesMatch([output], '123')).toBe(false);
  });
});
