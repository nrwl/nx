import { createClient } from '@supabase/supabase-js';
import { codeBlock, oneLine } from 'common-tags';
import GPT3Tokenizer from 'gpt3-tokenizer';
import {
  Configuration,
  OpenAIApi,
  CreateModerationResponse,
  CreateEmbeddingResponse,
} from 'openai-edge';
import { OpenAIStream, StreamingTextResponse } from 'ai';

const openAiKey = process.env.NX_OPENAI_KEY;
const supabaseUrl = process.env.NX_NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NX_SUPABASE_SERVICE_ROLE_KEY;
const config = new Configuration({
  apiKey: openAiKey,
});
const openai = new OpenAIApi(config);

export async function handler(query: any) {
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
      .then((res) => res.json());

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
      input: sanitizedQuery.replaceAll('\n', ' '),
    });

    if (embeddingResponse.status !== 200) {
      throw new ApplicationError(
        'Failed to create embedding for question',
        embeddingResponse
      );
    }

    const {
      data: [{ embedding }],
    }: CreateEmbeddingResponse = await embeddingResponse.json();

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

    const prompt = codeBlock`
      ${oneLine`
        You are a very enthusiastic Nx representative who loves
        to help people! Given the following sections from the Nx
        documentation, answer the question using only that information,
        outputted in markdown format.
        Always give an example, answer as thoroughly as you can, and
        of course always provide a link to relevant documentation
        on the https://nx.dev website. All the links you find or post 
        that look like local or relative links, always prepend with "https://nx.dev".
        Your answer should be in the form of a Markdown article, much like the
        existing Nx documentation. Include a title, and subsections, if it makes sense.
        If you are unsure and the answer is not explicitly written 
        in the documentation, say
        "Sorry, I don't know how to help with that. 
        You can visit the [Nx documentation](https://nx.dev/getting-started/intro) for more info."
      `}

      Context sections:
      ${contextText}

      Question: """
      ${sanitizedQuery}
      """

      Answer as markdown (including related code snippets if available):
    `;

    const response = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt,
      // max_tokens: 2048,
      temperature: 0,
      stream: true,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new ApplicationError('Failed to generate completion', error);
    }

    // Transform the response into a readable stream
    const stream = OpenAIStream(response);

    // Return a StreamingTextResponse, which can be consumed by the client
    return new StreamingTextResponse(stream);
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
