import type { APIRoute } from 'astro';
import { renderSectionIndex, textResponse } from '../../utils/llms';

export const GET: APIRoute = async ({ site }) =>
  textResponse(
    await renderSectionIndex('technologies', site?.origin ?? 'https://nx.dev')
  );
