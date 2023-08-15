export function formatMarkdownSources(sourcesMarkdown: string): string {
  return `\n
{% callout type="info" title="Sources" %}
${sourcesMarkdown}
{% /callout %}
\n`;
}
