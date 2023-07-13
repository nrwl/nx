// based on:
// https://github.com/supabase-community/nextjs-openai-doc-search/blob/main/pages/api/vector-search.ts

import { createClient } from '@supabase/supabase-js';
import GPT3Tokenizer from 'gpt3-tokenizer';
import {
  Configuration,
  OpenAIApi,
  CreateModerationResponse,
  CreateEmbeddingResponse,
  ChatCompletionRequestMessageRoleEnum,
  CreateCompletionResponseUsage,
} from 'openai';
import { getMessageFromResponse, sanitizeLinksInResponse } from './utils';

const openAiKey = process.env['NX_OPENAI_KEY'];
const supabaseUrl = process.env['NX_NEXT_PUBLIC_SUPABASE_URL'];
const supabaseServiceKey = process.env['NX_SUPABASE_SERVICE_ROLE_KEY'];
const config = new Configuration({
  apiKey: openAiKey,
});
const openai = new OpenAIApi(config);

export async function nxDevDataAccessAi(
  query: string
): Promise<{ textResponse: string; usage?: CreateCompletionResponseUsage }> {
  try {
    if (!openAiKey) {
      throw new ApplicationError('Missing environment variable NX_OPENAI_KEY');
    }

    if (!supabaseUrl) {
      throw new ApplicationError(
        'Missing environment variable NX_NEXT_PUBLIC_SUPABASE_URL'
      );
    }

    if (!supabaseServiceKey) {
      throw new ApplicationError(
        'Missing environment variable NX_SUPABASE_SERVICE_ROLE_KEY'
      );
    }

    if (!query) {
      throw new UserError('Missing query in request data');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Moderate the content to comply with OpenAI T&C
    const sanitizedQuery = query.trim();
    const moderationResponse: CreateModerationResponse = await openai
      .createModeration({ input: sanitizedQuery })
      .then((res) => res.data);

    const [results] = moderationResponse.results;

    if (results.flagged) {
      throw new UserError('Flagged content', {
        flagged: true,
        categories: results.categories,
      });
    }

    // Create embedding from query
    const embeddingResponse = await openai.createEmbedding({
      model: 'text-embedding-ada-002',
      input: sanitizedQuery,
    });

    if (embeddingResponse.status !== 200) {
      throw new ApplicationError(
        'Failed to create embedding for question',
        embeddingResponse
      );
    }

    const {
      data: [{ embedding }],
    }: CreateEmbeddingResponse = embeddingResponse.data;

    const { error: matchError, data: pageSections } = await supabaseClient.rpc(
      'match_page_sections',
      {
        embedding,
        match_threshold: 0.78,
        match_count: 10,
        min_content_length: 50,
      }
    );

    if (matchError) {
      throw new ApplicationError('Failed to match page sections', matchError);
    }

    const tokenizer = new GPT3Tokenizer({ type: 'gpt3' });
    let tokenCount = 0;
    let contextText = '';

    for (let i = 0; i < pageSections.length; i++) {
      const pageSection = pageSections[i];
      const content = pageSection.content;
      const encoded = tokenizer.encode(content);
      tokenCount += encoded.text.length;

      if (tokenCount >= 1500) {
        break;
      }

      contextText += `${content.trim()}\n---\n`;
    }

    const prompt = `
      ${`
      You are a knowledgeable Nx representative. 
      Your knowledge is based entirely on the official Nx documentation. 
      You should answer queries using ONLY that information.
      Answer in markdown format. Always give an example, answer as thoroughly as you can, and
      always provide a link to relevant documentation
      on the https://nx.dev website. All the links you find or post 
      that look like local or relative links, always prepend with "https://nx.dev".
      Your answer should be in the form of a Markdown article, much like the
      existing Nx documentation. Include a title, and subsections, if it makes sense.
      Mark the titles and the subsections with the appropriate markdown syntax.
      If you are unsure and the answer is not explicitly written in the Nx documentation, say
      "Sorry, I don't know how to help with that. 
      You can visit the [Nx documentation](https://nx.dev/getting-started/intro) for more info."
      Remember, answer the question using ONLY the information provided in the Nx documentation.
      Answer as markdown (including related code snippets if available).
      `
        .replace(/\s+/g, ' ')
        .trim()}
    `;

    const chatGptMessages = [
      {
        role: ChatCompletionRequestMessageRoleEnum.System,
        content: prompt,
      },
      {
        role: ChatCompletionRequestMessageRoleEnum.Assistant,
        content: contextText,
      },
      {
        role: ChatCompletionRequestMessageRoleEnum.User,
        content: sanitizedQuery,
      },
    ];

    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo-16k',
      messages: chatGptMessages,
      temperature: 0,
      stream: false,
    });

    if (response.status !== 200) {
      const error = response.data;
      throw new ApplicationError('Failed to generate completion', error);
    }

    const message = getMessageFromResponse(response.data);

    const responseWithoutBadLinks = await sanitizeLinksInResponse(message);

    return {
      textResponse: responseWithoutBadLinks,
      usage: response.data.usage,
    };
  } catch (err: unknown) {
    if (err instanceof UserError) {
      console.error(err.message);
    } else if (err instanceof ApplicationError) {
      // Print out application errors with their additional data
      console.error(`${err.message}: ${JSON.stringify(err.data)}`);
    } else {
      // Print out unexpected errors as is to help with debugging
      console.error(err);
    }

    // TODO: include more response info in debug environments
    console.error(err);
    throw err;
  }
}
export class ApplicationError extends Error {
  constructor(message: string, public data: Record<string, any> = {}) {
    super(message);
  }
}

export class UserError extends ApplicationError {}
