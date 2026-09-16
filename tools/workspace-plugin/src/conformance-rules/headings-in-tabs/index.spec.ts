import { checkHeadingsInTabs } from './index';

describe('headings-in-tabs', () => {
  function check(content: string) {
    return checkHeadingsInTabs(content, 'astro-docs/src/content/docs/a.mdoc');
  }

  it('should return no violations for headings outside of tabs', () => {
    expect(
      check(
        [
          '## Setup',
          '',
          '{% tabs %}',
          '{% tabitem label="npm" %}',
          'Run `npm install`.',
          '{% /tabitem %}',
          '{% /tabs %}',
          '',
          '## Next steps',
        ].join('\n')
      )
    ).toEqual([]);
  });

  it('should return a violation for a heading inside a tabitem', () => {
    const violations = check(
      [
        '{% tabs %}',
        '{% tabitem label="CircleCI" %}',
        '### Using CircleCI in a private repository',
        '',
        'Create an environment variable.',
        '{% /tabitem %}',
        '{% /tabs %}',
      ].join('\n')
    );

    expect(violations).toHaveLength(1);
    expect(violations[0].file).toBe('astro-docs/src/content/docs/a.mdoc');
    expect(violations[0].message).toContain(
      'Heading "Using CircleCI in a private repository" at line 3'
    );
  });

  it('should return a violation for a heading in tabs opened with attributes', () => {
    expect(
      check(
        [
          '{% tabs syncKey="ci-provider" %}',
          '#### Example',
          '{% /tabs %}',
        ].join('\n')
      )
    ).toHaveLength(1);
  });

  it('should ignore headings inside code blocks', () => {
    expect(
      check(
        [
          '{% tabs %}',
          '{% tabitem label="shell" %}',
          '```shell',
          '# Install the package',
          'npm install nx',
          '```',
          '{% /tabitem %}',
          '{% /tabs %}',
        ].join('\n')
      )
    ).toEqual([]);
  });

  it('should ignore headings inside tags that render their children as text', () => {
    expect(
      check(
        [
          '{% tabs %}',
          '{% tabitem label="Use an Agent" %}',
          '{% llm_copy_prompt title="Let an AI agent set it up" %}',
          '## Primary goal',
          'Create an Nx Agents workflow.',
          '{% /llm_copy_prompt %}',
          '{% /tabitem %}',
          '{% /tabs %}',
        ].join('\n')
      )
    ).toEqual([]);
  });

  it('should stop reporting once the tabs block is closed', () => {
    expect(
      check(['{% tabs %}', '{% /tabs %}', '## After the tabs'].join('\n'))
    ).toEqual([]);
  });
});
