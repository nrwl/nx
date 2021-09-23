import { transformLinkPath } from './transform-link-path';

describe('transformLinkPath', () => {
  it('should transform path containing version and flavour', () => {
    const transform = transformLinkPath({
      framework: {
        id: 'react',
        name: 'React',
        alias: 'r',
        path: 'react',
        default: true,
      },
      frameworkList: [
        { id: 'angular', name: 'Angular', alias: 'a', path: 'angular' },
        {
          id: 'react',
          name: 'React',
          alias: 'r',
          path: 'react',
          default: true,
        },
        { id: 'node', name: 'Node', alias: 'n', path: 'node' },
      ],
      version: {
        name: 'Latest',
        id: 'latest',
        alias: 'l',
        release: '12.9.0',
        path: 'latest',
        default: true,
      },
      versionList: [
        {
          name: 'Latest',
          id: 'latest',
          alias: 'l',
          release: '12.9.0',
          path: 'latest',
          default: true,
        },
        {
          name: 'Previous',
          id: 'previous',
          alias: 'p',
          release: '11.3.0',
          path: 'previous',
          default: false,
        },
      ],
    });

    expect(
      transform('/%7B%7Bversion%7D%7D/%7B%7Bframework%7D%7D/node/overview')
    ).toEqual('/l/r/node/overview');
  });
  it('should transform path containing flavour only', () => {
    const transform = transformLinkPath({
      framework: {
        id: 'react',
        name: 'React',
        alias: 'r',
        path: 'react',
        default: true,
      },
      frameworkList: [
        { id: 'angular', name: 'Angular', alias: 'a', path: 'angular' },
        {
          id: 'react',
          name: 'React',
          alias: 'r',
          path: 'react',
          default: true,
        },
        { id: 'node', name: 'Node', alias: 'n', path: 'node' },
      ],
      version: {
        name: 'Latest',
        id: 'latest',
        alias: 'l',
        release: '12.9.0',
        path: 'latest',
        default: true,
      },
      versionList: [
        {
          name: 'Latest',
          id: 'latest',
          alias: 'l',
          release: '12.9.0',
          path: 'latest',
          default: true,
        },
        {
          name: 'Previous',
          id: 'previous',
          alias: 'p',
          release: '11.3.0',
          path: 'previous',
          default: false,
        },
      ],
    });

    expect(transform('/l/%7B%7Bframework%7D%7D/node/overview')).toEqual(
      '/l/r/node/overview'
    );
  });
  it('should transform path containing version only', () => {
    const transform = transformLinkPath({
      framework: {
        id: 'react',
        name: 'React',
        alias: 'r',
        path: 'react',
        default: true,
      },
      frameworkList: [
        { id: 'angular', name: 'Angular', alias: 'a', path: 'angular' },
        {
          id: 'react',
          name: 'React',
          alias: 'r',
          path: 'react',
          default: true,
        },
        { id: 'node', name: 'Node', alias: 'n', path: 'node' },
      ],
      version: {
        name: 'Latest',
        id: 'latest',
        alias: 'l',
        release: '12.9.0',
        path: 'latest',
        default: true,
      },
      versionList: [
        {
          name: 'Latest',
          id: 'latest',
          alias: 'l',
          release: '12.9.0',
          path: 'latest',
          default: true,
        },
        {
          name: 'Previous',
          id: 'previous',
          alias: 'p',
          release: '11.3.0',
          path: 'previous',
          default: false,
        },
      ],
    });

    expect(transform('/%7B%7Bversion%7D%7D/r/node/overview')).toEqual(
      '/l/r/node/overview'
    );
  });
  it('should always prepend version if framework detected', () => {
    const transform = transformLinkPath({
      framework: {
        id: 'react',
        name: 'React',
        alias: 'r',
        path: 'react',
        default: true,
      },
      frameworkList: [
        { id: 'angular', name: 'Angular', alias: 'a', path: 'angular' },
        {
          id: 'react',
          name: 'React',
          alias: 'r',
          path: 'react',
          default: true,
        },
        { id: 'node', name: 'Node', alias: 'n', path: 'node' },
      ],
      version: {
        name: 'Latest',
        id: 'latest',
        alias: 'l',
        release: '12.9.0',
        path: 'latest',
        default: true,
      },
      versionList: [
        {
          name: 'Latest',
          id: 'latest',
          alias: 'l',
          release: '12.9.0',
          path: 'latest',
          default: true,
        },
        {
          name: 'Previous',
          id: 'previous',
          alias: 'p',
          release: '11.3.0',
          path: 'previous',
          default: false,
        },
      ],
    });

    expect(transform('/a/node/overview')).toEqual('/l/a/node/overview');
    expect(transform('/r/node/overview')).toEqual('/l/r/node/overview');
  });

  it('should always use version & framework aliasing', () => {
    const transform = transformLinkPath({
      framework: {
        id: 'react',
        name: 'React',
        alias: 'r',
        path: 'react',
        default: true,
      },
      frameworkList: [
        { id: 'angular', name: 'Angular', alias: 'a', path: 'angular' },
        {
          id: 'react',
          name: 'React',
          alias: 'r',
          path: 'react',
          default: true,
        },
        { id: 'node', name: 'Node', alias: 'n', path: 'node' },
      ],
      version: {
        name: 'Latest',
        id: 'latest',
        alias: 'l',
        release: '12.9.0',
        path: 'latest',
        default: true,
      },
      versionList: [
        {
          name: 'Latest',
          id: 'latest',
          alias: 'l',
          release: '12.9.0',
          path: 'latest',
          default: true,
        },
        {
          name: 'Previous',
          id: 'previous',
          alias: 'p',
          release: '11.3.0',
          path: 'previous',
          default: false,
        },
      ],
    });

    expect(transform('/latest/angular/node/overview')).toEqual(
      '/l/a/node/overview'
    );
    expect(transform('/latest/a/node/overview')).toEqual('/l/a/node/overview');
    expect(transform('/previous/react/node/overview')).toEqual(
      '/p/r/node/overview'
    );
    expect(transform('/p/react/node/overview')).toEqual('/p/r/node/overview');
  });
  it('should do nothing if unrecognized path', () => {
    const transform = transformLinkPath({
      framework: {
        id: 'react',
        name: 'React',
        alias: 'r',
        path: 'react',
        default: true,
      },
      frameworkList: [
        { id: 'angular', name: 'Angular', alias: 'a', path: 'angular' },
        {
          id: 'react',
          name: 'React',
          alias: 'r',
          path: 'react',
          default: true,
        },
        { id: 'node', name: 'Node', alias: 'n', path: 'node' },
      ],
      version: {
        name: 'Latest',
        id: 'latest',
        alias: 'l',
        release: '12.9.0',
        path: 'latest',
        default: true,
      },
      versionList: [
        {
          name: 'Latest',
          id: 'latest',
          alias: 'l',
          release: '12.9.0',
          path: 'latest',
          default: true,
        },
        {
          name: 'Previous',
          id: 'previous',
          alias: 'p',
          release: '11.3.0',
          path: 'previous',
          default: false,
        },
      ],
    });

    expect(transform('/%7B%7Bxxx%7D%7D/%7B%7Byyy%7D%7D/node/overview')).toEqual(
      '/%7B%7Bxxx%7D%7D/%7B%7Byyy%7D%7D/node/overview'
    );
  });
  it('should not transform path when internal or anchor links', () => {
    const transform = transformLinkPath({
      framework: {
        id: 'react',
        name: 'React',
        alias: 'r',
        path: 'react',
        default: true,
      },
      frameworkList: [
        { id: 'angular', name: 'Angular', alias: 'a', path: 'angular' },
        {
          id: 'react',
          name: 'React',
          alias: 'r',
          path: 'react',
          default: true,
        },
        { id: 'node', name: 'Node', alias: 'n', path: 'node' },
      ],
      version: {
        name: 'Latest',
        id: 'latest',
        alias: 'l',
        release: '12.9.0',
        path: 'latest',
        default: true,
      },
      versionList: [
        {
          name: 'Latest',
          id: 'latest',
          alias: 'l',
          release: '12.9.0',
          path: 'latest',
          default: true,
        },
        {
          name: 'Previous',
          id: 'previous',
          alias: 'p',
          release: '11.3.0',
          path: 'previous',
          default: false,
        },
      ],
    });

    expect(transform('#something-path')).toEqual('#something-path');
    expect(transform('https://somewhere.path')).toEqual(
      'https://somewhere.path'
    );
  });
});
