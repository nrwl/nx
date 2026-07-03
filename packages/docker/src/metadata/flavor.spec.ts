import { parseFlavor } from './flavor';

describe('parseFlavor', () => {
  it('defaults to auto/no-prefix/no-suffix when empty', () => {
    expect(parseFlavor([])).toEqual({
      latest: 'auto',
      prefix: '',
      prefixLatest: false,
      suffix: '',
      suffixLatest: false,
    });
  });

  it('parses latest override', () => {
    expect(parseFlavor(['latest=true']).latest).toEqual('true');
  });

  it('throws on invalid latest value', () => {
    expect(() => parseFlavor(['latest=maybe'])).toThrow(/Invalid latest/);
  });

  it('parses prefix with onlatest', () => {
    expect(parseFlavor(['prefix=v,onlatest=true'])).toEqual({
      latest: 'auto',
      prefix: 'v',
      prefixLatest: true,
      suffix: '',
      suffixLatest: false,
    });
  });

  it('parses suffix with onlatest', () => {
    expect(parseFlavor(['suffix=-alpine,onlatest=true'])).toEqual({
      latest: 'auto',
      prefix: '',
      prefixLatest: false,
      suffix: '-alpine',
      suffixLatest: true,
    });
  });

  it('defaults onlatest to false when not specified', () => {
    expect(parseFlavor(['prefix=v']).prefixLatest).toBe(false);
  });

  it('throws on a bare entry with no `=`', () => {
    expect(() => parseFlavor(['justastring'])).toThrow(/Invalid flavor entry/);
  });

  it('throws on an unknown key', () => {
    expect(() => parseFlavor(['foo=bar'])).toThrow(/Unknown flavor entry/);
  });

  it('throws on an invalid onlatest value', () => {
    expect(() => parseFlavor(['prefix=v,onlatest=maybe'])).toThrow(
      /Invalid value for onlatest/
    );
  });
});
