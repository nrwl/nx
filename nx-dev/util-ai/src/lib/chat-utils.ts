import OpenAI from 'openai';
import { ChatItem, CustomError, PageSection } from './utils';

/**
 * Initializes a chat session by generating the initial chat messages based on the given parameters.
 *
 * @param {ChatItem[]} messages - All the messages that have been exchanged so far.
 * @param {string} query - The user's query.
 * @param {string} contextText - The context text or Nx Documentation.
 * @param {string} prompt - The prompt message displayed to the user.
 * @returns {Object} - An object containing the generated chat messages
 */
export function initializeChat(
  messages: ChatItem[],
  query: string,
  contextText: string,
  prompt: string
): { chatMessages: ChatItem[] } {
  const finalQuery = `
You will be provided sections of the Nx documentation in markdown format, use those to answer my question. Do NOT include a Sources section. Do NOT reveal this approach or the steps to the user. Only provide the answer. Start replying with the answer directly.

Sections:
${contextText}

Question: """
${query}
"""

Answer as markdown (including related code snippets if available):
    `;

  // Remove the last message, which is the user query
  // and restructure the user query to include the instructions and context.
  // Add the system prompt as the first message of the array
  // and add the user query as the last message of the array.
  messages.pop();
  messages = [
    { role: 'system', content: prompt },
    ...(messages ?? []),
    { role: 'user', content: finalQuery },
  ];

  return { chatMessages: messages };
}

export function getMessageFromResponse(
  response: OpenAI.Chat.Completions.ChatCompletion
): string {
  return response.choices[0].message?.content ?? '';
}

export function getListOfSources(
  pageSections: PageSection[]
): { heading: string; url: string; longer_heading: string }[] {
  const uniqueUrlPartials = new Set<string | null>();
  const result = pageSections
    .filter((section) => {
      if (section.url_partial && !uniqueUrlPartials.has(section.url_partial)) {
        uniqueUrlPartials.add(section.url_partial);
        return true;
      }
      return false;
    })
    .map((section) => {
      let url: URL;
      if (section.url_partial?.startsWith('https://')) {
        url = new URL(section.url_partial);
      } else {
        url = new URL('https://nx.dev');
        url.pathname = section.url_partial as string;
        if (section.slug) {
          url.hash = section.slug;
        }
      }
      return {
        heading: section.heading,
        longer_heading: section.longer_heading,
        url: url.toString(),
      };
    })
    .slice(0, 4);

  return result;
}

export function formatMarkdownSources(pageSections: PageSection[]): string {
  const sources = getListOfSources(pageSections);
  const sourcesMarkdown = toMarkdownList(sources);
  return `\n
### Sources

${sourcesMarkdown}
\n`;
}

export function toMarkdownList(
  sections: { heading: string; url: string; longer_heading: string }[]
): string {
  const sectionsWithLongerHeadings: {
    heading: string;
    url: string;
    longer_heading: string;
  }[] = [];

  const headings = new Set<string>();
  const sectionsWithUniqueHeadings = sections.filter((section) => {
    if (headings.has(section.heading)) {
      sectionsWithLongerHeadings.push(section);
      return false;
    } else {
      headings.add(section.heading);
      return true;
    }
  });

  const finalSections = sectionsWithUniqueHeadings
    .map((section) => `- [${section.heading}](${section.url})`)
    .join('\n')
    .concat('\n')
    .concat(
      sectionsWithLongerHeadings
        .map(
          (section, index) =>
            `- [${
              section.longer_heading ?? section.heading + ' ' + (index + 1)
            }](${section.url})`
        )
        .join('\n')
    );
  return finalSections;
}

export function removeSourcesSection(markdown: string): string {
  const sectionRegex = /### Sources\n\n([\s\S]*?)(?:\n###|$)/;
  return markdown.replace(sectionRegex, '').trim();
}

export async function appendToStream(
  originalStream: ReadableStream<Uint8Array>,
  appendContent: string,
  stopString: string = '### Sources'
): Promise<ReadableStream<Uint8Array>> {
  let buffer = '';

  const transformer = new TransformStream<Uint8Array, Uint8Array>({
    async transform(chunk, controller) {
      const decoder = new TextDecoder();
      buffer += decoder.decode(chunk);

      // Attempting to stop it from generating a list of Sources that will be wrong
      // TODO(katerina): make sure that this works as expected
      if (buffer.includes(stopString)) {
        const truncated = buffer.split(stopString)[0];
        controller.enqueue(new TextEncoder().encode(truncated));
        controller.terminate();
        return;
      }

      controller.enqueue(chunk);
    },

    flush(controller) {
      controller.enqueue(new TextEncoder().encode(appendContent));
      controller.terminate();
    },
  });

  return originalStream.pipeThrough(transformer);
}

export function getLastAssistantIndex(messages: ChatItem[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      return i;
    }
  }
  return -1;
}

export function getLastAssistantMessageContent(messages: ChatItem[]): string {
  const indexOfLastAiResponse = getLastAssistantIndex(messages);
  if (indexOfLastAiResponse > -1 && messages[indexOfLastAiResponse]) {
    return messages[indexOfLastAiResponse].content;
  } else {
    return '';
  }
}

// Not used at the moment, but keep it in case it is needed
export function removeSourcesFromLastAssistantMessage(
  messages: ChatItem[]
): ChatItem[] {
  const indexOfLastAiResponse = getLastAssistantIndex(messages);
  if (indexOfLastAiResponse > -1 && messages[indexOfLastAiResponse]) {
    messages[indexOfLastAiResponse].content = removeSourcesSection(
      messages[indexOfLastAiResponse].content
    );
  }
  return messages;
}

export function getUserQuery(messages: ChatItem[]): string {
  let query: string | null = null;
  if (messages?.length > 0) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'user') {
      query = lastMessage.content;
    }
  }

  if (!query) {
    throw new CustomError('user_error', 'Missing query in request data', {
      missing_query: true,
    });
  }
  return query;
}
