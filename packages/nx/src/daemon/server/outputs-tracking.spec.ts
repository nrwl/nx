import {
  _outputsHashesMatch,
  _recordOutputsHash,
  processFileChangesInOutputs,
  recordedHash,
} from './outputs-tracking';

describe('outputs tracking', () => {
  const now = new Date().getTime() + 10000;
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
    processFileChangesInOutputs(
      [{ path: 'dist/app/app1', type: 'update' }],
      now
    );
    expect(recordedHash('dist/app/app1')).toBeUndefined();
  });

  it('should invalidate output when it is a child', () => {
    _recordOutputsHash(['dist/app/app1'], '123');
    processFileChangesInOutputs(
      [{ path: 'dist/app/app1/child', type: 'update' }],
      now
    );
    expect(recordedHash('dist/app/app1')).toBeUndefined();
  });

  it('should invalidate output when it is a parent', () => {
    _recordOutputsHash(['dist/app/app1'], '123');
    processFileChangesInOutputs([{ path: 'dist/app', type: 'update' }], now);
    expect(recordedHash('dist/app/app1')).toBeUndefined();
  });

  it('should not invalidate anything when no match', () => {
    _recordOutputsHash(['dist/app/app1'], '123');
    processFileChangesInOutputs([{ path: 'dist/app2', type: 'update' }], now);
    expect(recordedHash('dist/app/app1')).toEqual('123');
  });
});
