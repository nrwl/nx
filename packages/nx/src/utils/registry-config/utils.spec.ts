import { getPackageScope, nerfDart } from './utils';

describe('getPackageScope', () => {
  it.each([
    ['@types/node', '@types'],
    ['@nx/devkit', '@nx'],
    ['is-even', null],
    ['@malformed', null],
  ])('%s -> %s', (pkg, scope) => {
    expect(getPackageScope(pkg)).toEqual(scope);
  });
});

describe('nerfDart', () => {
  it.each([
    ['https://registry.npmjs.org/', '//registry.npmjs.org/'],
    ['https://r.example.com/npm/', '//r.example.com/npm/'],
    // Without a trailing slash the last segment is dropped (npm semantics).
    ['https://r.example.com/npm', '//r.example.com/'],
    ['https://r.example.com:8443/a/b/', '//r.example.com:8443/a/b/'],
    ['not a url', null],
  ])('%s -> %s', (url, dart) => {
    expect(nerfDart(url)).toEqual(dart);
  });
});
