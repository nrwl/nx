import { renderMarkdown } from '@nx/nx-dev/ui-markdoc';

export const warning = renderMarkdown(
  `
  {% callout type="warning" title="Always double check!" %}
  This feature is still in Alpha.
  The results may not be accurate, so please always double check with our documentation.
{% /callout %}
  `,
  { filePath: '' }
).node;

export const infoBox = renderMarkdown(
  `
  {% callout type="info" title="New question or continue chat?" %}
  This chat has memory. It will answer all it's questions in the context of the previous questions.
  If you want to ask a new question, you can reset the chat history by clicking the "Ask new question" button.
  {% /callout %}
  `,
  { filePath: '' }
).node;
