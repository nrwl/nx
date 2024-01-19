import { output } from '../../utils/output';
import { sendPostRequest } from './lib/get-response-from-ai';

export interface AiArgs {
  prompt?: string | undefined;
}

/**
 * Write in natural language what you want to run. *
 *
 * @remarks
 *
 * Must be run within an Nx workspace
 *
 */
export async function aiHandler(args: AiArgs): Promise<void> {
  if (args.prompt) {
    try {
      const response = await sendPostRequest({ query: args.prompt });
      if (typeof response === 'string') {
        output.note({
          title: 'The command you need to run is:',
          bodyLines: [response],
        });
      } else {
        output.error({
          title: 'Could not find a command to run.',
          bodyLines: ['Please check out our docs: https://nx.dev/nx-api'],
        });
      }
    } catch (error) {
      console.error('Error:', error);
    }
  } else {
    output.error({
      title: 'Please provide a prompt.',
      bodyLines: ['Example: nx ai "I want to generate a new react component"'],
    });
  }
}
