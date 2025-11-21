import { describe, it, expect } from 'vitest';
import { stripMarkdocTags } from './strip-markdoc-tags';

describe('stripMarkdocTags', () => {
  describe('transformCallouts', () => {
    it('should transform callout with type="note" to Starlight note', () => {
      const input = `{% callout type="note" %}
This is a note content
{% /callout %}`;
      const expected = `:::note
This is a note content
:::`;
      expect(stripMarkdocTags(input)).toBe(expected);
    });

    it('should transform callout with type="caution" to Starlight caution', () => {
      const input = `{% callout type="caution" %}
Be careful!
{% /callout %}`;
      const expected = `:::caution
Be careful!
:::`;
      expect(stripMarkdocTags(input)).toBe(expected);
    });

    it('should transform callout with type="warning" to Starlight danger', () => {
      const input = `{% callout type="warning" %}
This is dangerous!
{% /callout %}`;
      const expected = `:::danger
This is dangerous!
:::`;
      expect(stripMarkdocTags(input)).toBe(expected);
    });

    it('should transform callout with type="info" to Starlight tip', () => {
      const input = `{% callout type="info" %}
Here's a tip
{% /callout %}`;
      const expected = `:::tip
Here's a tip
:::`;
      expect(stripMarkdocTags(input)).toBe(expected);
    });

    it('should include title when provided', () => {
      const input = `{% callout type="note" title="Important Note" %}
This is the content
{% /callout %}`;
      const expected = `:::note[Important Note]
This is the content
:::`;
      expect(stripMarkdocTags(input)).toBe(expected);
    });

    it('should handle unknown callout types as note', () => {
      const input = `{% callout type="unknown" %}
Some content
{% /callout %}`;
      const expected = `:::note
Some content
:::`;
      expect(stripMarkdocTags(input)).toBe(expected);
    });

    it('should handle multiple callouts in content', () => {
      const input = `Some text before
{% callout type="note" %}
First note
{% /callout %}
Middle text
{% callout type="caution" title="Watch out" %}
Second callout
{% /callout %}
End text`;
      const expected = `Some text before
:::note
First note
:::
Middle text
:::caution[Watch out]
Second callout
:::
End text`;
      expect(stripMarkdocTags(input)).toBe(expected);
    });
  });

  describe('transformTabs', () => {
    it('should transform simple tabs to headers', () => {
      const input = `{% tabs %}
{% tab label="First Tab" %}
Content of first tab
{% /tab %}
{% tab label="Second Tab" %}
Content of second tab
{% /tab %}
{% /tabs %}`;
      const expected = `#### First Tab

Content of first tab

#### Second Tab

Content of second tab`;
      expect(stripMarkdocTags(input)).toBe(expected);
    });

    it('should handle tabs with code blocks', () => {
      const input = `{% tabs %}
{% tab label="JavaScript" %}
\`\`\`js
console.log('Hello');
\`\`\`
{% /tab %}
{% tab label="TypeScript" %}
\`\`\`ts
console.log('Hello' as string);
\`\`\`
{% /tab %}
{% /tabs %}`;
      const expected = `#### JavaScript

\`\`\`js
console.log('Hello');
\`\`\`

#### TypeScript

\`\`\`ts
console.log('Hello' as string);
\`\`\``;
      expect(stripMarkdocTags(input)).toBe(expected);
    });

    it('should handle tabs with complex content', () => {
      const input = `{% tabs %}
{% tab label="Installation" %}
Run the following command:

\`\`\`bash
npm install package
\`\`\`

Then configure it.
{% /tab %}
{% tab label="Usage" %}
Import and use:

\`\`\`js
import pkg from 'package';
pkg.init();
\`\`\`
{% /tab %}
{% /tabs %}`;
      const expected = `#### Installation

Run the following command:

\`\`\`bash
npm install package
\`\`\`

Then configure it.

#### Usage

Import and use:

\`\`\`js
import pkg from 'package';
pkg.init();
\`\`\``;
      expect(stripMarkdocTags(input)).toBe(expected);
    });

    it('should handle empty tabs gracefully', () => {
      const input = `{% tabs %}
{% tab label="Empty Tab" %}
{% /tab %}
{% tab label="Tab with Content" %}
Some content
{% /tab %}
{% /tabs %}`;
      const expected = `#### Empty Tab



#### Tab with Content

Some content`;
      expect(stripMarkdocTags(input)).toBe(expected);
    });

    it('should preserve surrounding content', () => {
      const input = `# Header Before

Some text before tabs.

{% tabs %}
{% tab label="Tab 1" %}
Content 1
{% /tab %}
{% /tabs %}

Some text after tabs.`;
      const expected = `# Header Before

Some text before tabs.

#### Tab 1

Content 1

Some text after tabs.`;
      expect(stripMarkdocTags(input)).toBe(expected);
    });

    it('should handle multiple tab groups', () => {
      const input = `First group:
{% tabs %}
{% tab label="A" %}
Content A
{% /tab %}
{% /tabs %}

Second group:
{% tabs %}
{% tab label="B" %}
Content B
{% /tab %}
{% /tabs %}`;
      const expected = `First group:
#### A

Content A

Second group:
#### B

Content B`;
      expect(stripMarkdocTags(input)).toBe(expected);
    });
  });

  describe('combined transformations', () => {
    it('should handle all transformations together', () => {
      const input = `# Documentation

{% callout type="note" title="Getting Started" %}
Follow these steps to begin.
{% /callout %}

## Examples

{% tabs %}
{% tab label="Basic Setup" %}
Install the package:
\`\`\`bash
npm install
\`\`\`
{% /tab %}
{% tab label="Advanced Setup" %}
Configure advanced options.
{% /tab %}
{% /tabs %}

{% callout type="warning" %}
Be careful with this!
{% /callout %}`;

      const expected = `# Documentation

:::note[Getting Started]
Follow these steps to begin.
:::

## Examples

#### Basic Setup

Install the package:
\`\`\`bash
npm install
\`\`\`

#### Advanced Setup

Configure advanced options.

:::danger
Be careful with this!
:::`;
      expect(stripMarkdocTags(input)).toBe(expected);
    });

    it('should handle content with no Markdoc tags', () => {
      const input = `# Regular Markdown

This is just regular markdown content.

## Section

- List item 1
- List item 2

\`\`\`js
const code = 'example';
\`\`\``;

      expect(stripMarkdocTags(input)).toBe(input);
    });
  });
});
