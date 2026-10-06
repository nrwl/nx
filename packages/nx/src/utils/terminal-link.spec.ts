import { parseVersion, terminalLink } from './terminal-link';

describe('terminalLink', () => {
  const OSC = '\u001B]';
  const BEL = '\u0007';
  let originalForce: string | undefined;

  beforeEach(() => {
    originalForce = process.env.FORCE_HYPERLINK;
  });

  afterEach(() => {
    if (originalForce === undefined) {
      delete process.env.FORCE_HYPERLINK;
    } else {
      process.env.FORCE_HYPERLINK = originalForce;
    }
  });

  it('wraps text in an OSC 8 sequence when hyperlinks are supported', () => {
    process.env.FORCE_HYPERLINK = '1';
    const result = terminalLink('label', 'https://example.com');
    expect(result).toBe(
      `${OSC}8;;https://example.com${BEL}label${OSC}8;;${BEL}`
    );
  });

  it('returns plain text when hyperlinks are not supported', () => {
    process.env.FORCE_HYPERLINK = '0';
    expect(terminalLink('label', 'https://example.com')).toBe('label');
  });
});

describe('parseVersion', () => {
  it.each([
    // VTE packed integers: "5402" -> 0.54.2
    ['5402', { major: 0, minor: 54, patch: 2 }],
    ['5000', { major: 0, minor: 50, patch: 0 }],
    ['501', { major: 0, minor: 5, patch: 1 }],
    // Dot-separated versions
    ['3.5.0', { major: 3, minor: 5, patch: 0 }],
    ['1.72', { major: 1, minor: 72, patch: 0 }],
    ['20200620', { major: 20200620, minor: 0, patch: 0 }],
    // Missing / malformed input defaults to zeros
    ['', { major: 0, minor: 0, patch: 0 }],
    [undefined, { major: 0, minor: 0, patch: 0 }],
  ])('parses %p', (input, expected) => {
    expect(parseVersion(input as string | undefined)).toEqual(expected);
  });
});
