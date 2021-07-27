import { transformLinkPath } from './transform-link-path';

describe('transformLinkPath', () => {
  it('should transform path containing version and flavour', () => {
    const transform = transformLinkPath({
      framework: 'react',
      frameworkList: ['angular', 'node', 'react'],
      version: 'latest',
      versionList: ['latest', 'previous'],
    });

    expect(
      transform('/%7B%7Bversion%7D%7D/%7B%7Bframework%7D%7D/node/overview')
    ).toEqual('/latest/react/node/overview');
  });
  it('should transform path containing flavour only', () => {
    const transform = transformLinkPath({
      framework: 'react',
      frameworkList: ['angular', 'node', 'react'],
      version: 'latest',
      versionList: ['latest', 'previous'],
    });

    expect(transform('/latest/%7B%7Bframework%7D%7D/node/overview')).toEqual(
      '/latest/react/node/overview'
    );
  });
  it('should transform path containing version only', () => {
    const transform = transformLinkPath({
      framework: 'react',
      frameworkList: ['angular', 'node', 'react'],
      version: 'latest',
      versionList: ['latest', 'previous'],
    });

    expect(transform('/%7B%7Bversion%7D%7D/react/node/overview')).toEqual(
      '/latest/react/node/overview'
    );
  });
  it('should always prepend version if framework detected', () => {
    const transform = transformLinkPath({
      framework: 'react',
      frameworkList: ['angular', 'node', 'react'],
      version: 'latest',
      versionList: ['latest', 'previous'],
    });

    expect(transform('/angular/node/overview')).toEqual(
      '/latest/angular/node/overview'
    );
    expect(transform('/react/node/overview')).toEqual(
      '/latest/react/node/overview'
    );
  });
  it('should do nothing if unrecognized path', () => {
    const transform = transformLinkPath({
      framework: 'react',
      frameworkList: ['angular', 'node', 'react'],
      version: 'latest',
      versionList: ['latest', 'previous'],
    });

    expect(transform('/%7B%7Bxxx%7D%7D/%7B%7Byyy%7D%7D/node/overview')).toEqual(
      '/%7B%7Bxxx%7D%7D/%7B%7Byyy%7D%7D/node/overview'
    );
  });
  it('should not transform path when internal or anchor links', () => {
    const transform = transformLinkPath({
      framework: 'react',
      frameworkList: ['angular', 'node', 'react'],
      version: 'latest',
      versionList: ['latest', 'previous'],
    });

    expect(transform('#something-path')).toEqual('#something-path');
    expect(transform('https://somewhere.path')).toEqual(
      'https://somewhere.path'
    );
  });
});
