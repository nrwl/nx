import { parseFrontmatter } from './frontmatter';

function source(...lines: string[]) {
  return ['#!/usr/bin/env node', ...lines].join('\n');
}

describe('parseFrontmatter', () => {
  it('should read a JSDoc-style @nx block', () => {
    expect(
      parseFrontmatter(
        source(
          '/**',
          ' * @nx',
          ' * name: publish-docs',
          ' * dependsOn:',
          ' *   - build',
          ' */'
        )
      )
    ).toEqual({ name: 'publish-docs', dependsOn: ['build'] });
  });

  it('should accept the marker on the opening line and no line prefixes', () => {
    expect(
      parseFrontmatter(
        source(
          '/* @nx',
          'name: publish-docs',
          'outputs: ["{projectRoot}/out"]',
          '*/'
        )
      )
    ).toEqual({ name: 'publish-docs', outputs: ['{projectRoot}/out'] });
  });

  it('should accept a single-line block, CRLF and blank lines after the shebang', () => {
    expect(
      parseFrontmatter(
        ['#!/usr/bin/env node', '', '/** @nx name: seed */', 'run();'].join(
          '\r\n'
        )
      )
    ).toEqual({ name: 'seed' });
  });

  it('should ignore comments without the @nx marker', () => {
    expect(parseFrontmatter(source('/** Seeds the database. */'))).toEqual({});
    expect(parseFrontmatter(source('/** @nx-other x */'))).toEqual({});
    expect(parseFrontmatter(source('// @nx name: seed'))).toEqual({});
    expect(parseFrontmatter(source('console.log(1);'))).toEqual({});
  });

  it('should throw on malformed YAML', () => {
    expect(() =>
      parseFrontmatter(source('/**', ' * @nx', ' * name: [oops', ' */'))
    ).toThrow();
  });

  it('should throw on an unterminated @nx block', () => {
    expect(() =>
      parseFrontmatter(source('/**', ' * @nx', ' * name: x'))
    ).toThrow(/Unterminated/);
  });
});
