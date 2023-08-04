import { CreateChatCompletionResponse } from 'openai';
export interface PageSection {
  id: number;
  page_id: number;
  content: string;
  heading: string;
  similarity: number;
  slug: string;
  url_partial: string | null;
}

export function getMessageFromResponse(
  response: CreateChatCompletionResponse
): string {
  /**
   *
   * This function here will or may be enhanced
   * once we add more functionality
   */
  return response.choices[0].message?.content ?? '';
}

export function getListOfSources(
  pageSections: PageSection[]
): { heading: string; url: string }[] {
  const uniqueUrlPartials = new Set<string | null>();
  const result = pageSections
    .filter((section) => {
      if (section.url_partial && !uniqueUrlPartials.has(section.url_partial)) {
        uniqueUrlPartials.add(section.url_partial);
        return true;
      }
      return false;
    })
    .map((section) => ({
      heading: section.heading,
      url: `https://nx.dev${section.url_partial}`,
    }));

  return result;
}

export function toMarkdownList(
  sections: { heading: string; url: string }[]
): string {
  return sections
    .map((section) => `- [${section.heading}](${section.url})`)
    .join('\n');
}

export async function sanitizeLinksInResponse(
  response: string
): Promise<string> {
  const regex = /https:\/\/nx\.dev[^) \n]*[^).]/g;
  const urls = response.match(regex);

  if (urls) {
    for (const url of urls) {
      const linkIsWrong = await is404(url);
      if (linkIsWrong) {
        response = response.replace(
          url,
          'https://nx.dev/getting-started/intro'
        );
      }
    }
  }

  return response;
}

async function is404(url: string): Promise<boolean> {
  try {
    const response = await fetch(url.replace('https://nx.dev', ''));
    if (response.status === 404) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    if ((error as any)?.response?.status === 404) {
      return true;
    } else {
      return false;
    }
  }
}
