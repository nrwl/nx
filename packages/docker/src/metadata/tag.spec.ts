import { parseTag, parseTags } from './tag';
import { DEFAULT_TAG_PRIORITIES } from './types';

describe('parseTag', () => {
  it('defaults to a raw tag when no type is given', () => {
    expect(parseTag('acustomtag')).toEqual({
      type: 'raw',
      attrs: {
        priority: DEFAULT_TAG_PRIORITIES.raw,
        enable: 'true',
        value: 'acustomtag',
      },
    });
  });

  it('parses a schedule tag with default pattern', () => {
    expect(parseTag('type=schedule')).toEqual({
      type: 'schedule',
      attrs: {
        priority: DEFAULT_TAG_PRIORITIES.schedule,
        enable: 'true',
        pattern: 'nightly',
      },
    });
  });

  it('preserves embedded `=` characters in a pattern value', () => {
    expect(
      parseTag(
        `type=schedule,enable=true,pattern={{date 'YYYYMMDD' tz='Asia/Tokyo'}}`
      )
    ).toEqual({
      type: 'schedule',
      attrs: {
        priority: DEFAULT_TAG_PRIORITIES.schedule,
        enable: 'true',
        pattern: `{{date 'YYYYMMDD' tz='Asia/Tokyo'}}`,
      },
    });
  });

  it('parses a semver tag and defaults value to empty string', () => {
    expect(parseTag('type=semver,pattern={{version}}')).toEqual({
      type: 'semver',
      attrs: {
        priority: DEFAULT_TAG_PRIORITIES.semver,
        enable: 'true',
        pattern: '{{version}}',
        value: '',
      },
    });
  });

  it('throws when semver is missing a pattern', () => {
    expect(() => parseTag('type=semver')).toThrow(/Missing pattern/);
  });

  it('parses a match tag with a quoted pattern containing regex metacharacters', () => {
    expect(parseTag('type=match,"pattern=^v(\\d.\\d.\\d)$",group=1')).toEqual({
      type: 'match',
      attrs: {
        priority: DEFAULT_TAG_PRIORITIES.match,
        enable: 'true',
        pattern: '^v(\\d.\\d.\\d)$',
        group: '1',
        value: '',
      },
    });
  });

  it('throws when match group is not numeric', () => {
    expect(() => parseTag('type=match,pattern=v(.*),group=foo')).toThrow(
      /Invalid match group/
    );
  });

  it('defaults ref pr prefix to `pr-`', () => {
    expect(parseTag('type=ref,event=pr')).toEqual({
      type: 'ref',
      attrs: {
        priority: DEFAULT_TAG_PRIORITIES.ref,
        enable: 'true',
        prefix: 'pr-',
        event: 'pr',
      },
    });
  });

  it('throws on an invalid ref event', () => {
    expect(() => parseTag('type=ref,event=foo')).toThrow(/Invalid event/);
  });

  it('throws when ref is missing an event', () => {
    expect(() => parseTag('type=ref')).toThrow(/Missing event/);
  });

  it('defaults sha prefix/format', () => {
    expect(parseTag('type=sha')).toEqual({
      type: 'sha',
      attrs: {
        priority: DEFAULT_TAG_PRIORITIES.sha,
        enable: 'true',
        prefix: 'sha-',
        format: 'short',
      },
    });
  });

  it('throws on an invalid sha format', () => {
    expect(() => parseTag('type=sha,format=foo')).toThrow(/Invalid format/);
  });

  it('throws on an unknown tag type', () => {
    expect(() => parseTag('type=foo')).toThrow(/Unknown tag type/);
  });

  it('respects an explicit priority override', () => {
    expect(
      parseTag('type=semver,priority=1,pattern={{version}}').attrs['priority']
    ).toEqual('1');
  });
});

describe('parseTags', () => {
  it('defaults to schedule + branch/tag/pr ref rules when empty', () => {
    const tags = parseTags([]);
    expect(tags.map((t) => t.type)).toEqual(['schedule', 'ref', 'ref', 'ref']);
  });

  it('sorts by priority, highest first', () => {
    const tags = parseTags(['type=sha', 'type=schedule', 'type=raw,value=x']);
    expect(tags.map((t) => t.type)).toEqual(['schedule', 'raw', 'sha']);
  });
});
