import { parseImages } from './image';

describe('parseImages', () => {
  it('parses legacy comma-separated shorthand as a single input', () => {
    expect(parseImages(['ghcr.io/user/app,docker.io/user/app'])).toEqual([
      { name: 'ghcr.io/user/app', enable: true },
      { name: 'docker.io/user/app', enable: true },
    ]);
  });

  it('parses a single bare image name', () => {
    expect(parseImages(['ghcr.io/user/app'])).toEqual([
      { name: 'ghcr.io/user/app', enable: true },
    ]);
  });

  it('parses name=/enable= attribute syntax across multiple inputs', () => {
    expect(
      parseImages([
        'name=ghcr.io/user/app,enable=true',
        'name=user/app,enable=false',
      ])
    ).toEqual([
      { name: 'ghcr.io/user/app', enable: true },
      { name: 'user/app', enable: false },
    ]);
  });

  it('defaults enable to true when omitted in attribute syntax', () => {
    expect(parseImages(['name=user/app'])).toEqual([
      { name: 'user/app', enable: true },
    ]);
  });

  it('throws on an empty image name', () => {
    expect(() => parseImages(['enable=true'])).toThrow(/empty/);
  });

  it('throws on an invalid enable value', () => {
    expect(() => parseImages(['name=user/app,enable=maybe'])).toThrow(
      /Invalid enable attribute/
    );
  });

  it('throws on an unknown attribute', () => {
    expect(() => parseImages(['name=user/app,foo=bar'])).toThrow(
      /Unknown image attribute/
    );
  });
});
