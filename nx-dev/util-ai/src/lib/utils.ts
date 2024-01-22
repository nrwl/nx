import OpenAI from 'openai';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

let openai: OpenAI;
let supabaseClient: SupabaseClient<any, 'public', any>;

export function getOpenAI(openAiKey?: string): OpenAI {
  if (openai) return openai;
  if (!openAiKey) {
    throw new CustomError(
      'application_error',
      'Missing environment variable NX_OPENAI_KEY',
      {
        missing_key: true,
      }
    );
  }
  openai = new OpenAI({ apiKey: openAiKey });
  return openai;
}

export function getSupabaseClient(
  supabaseUrl?: string,
  supabaseServiceKey?: string
): SupabaseClient<any, 'public', any> {
  if (supabaseClient) return supabaseClient;
  if (!supabaseUrl) {
    throw new CustomError(
      'application_error',
      'Missing environment variable NX_NEXT_PUBLIC_SUPABASE_URL',
      { missing_key: true }
    );
  }
  if (!supabaseServiceKey) {
    throw new CustomError(
      'application_error',
      'Missing environment variable NX_SUPABASE_SERVICE_ROLE_KEY',
      { missing_key: true }
    );
  }
  supabaseClient = createClient(
    supabaseUrl as string,
    supabaseServiceKey as string
  );
  return supabaseClient;
}

export class CustomError extends Error {
  public type: string;
  public data: Record<string, any>;

  constructor(
    type: string = 'application_error',
    message: string,
    data: Record<string, any> = {}
  ) {
    super(message);
    this.type = type;
    this.data = data;
  }
}

export interface PageSection {
  id: number;
  page_id: number;
  content: string;
  heading: string;
  longer_heading: string;
  similarity: number;
  slug: string;
  url_partial: string | null;
}

export interface ChatItem {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
}

export interface ErrorResponse {
  message: string;
  data?: any;
}

export function extractErrorMessage(err: unknown): ErrorResponse {
  if (err instanceof CustomError) {
    return { message: err.message, data: err.data };
  }

  if (typeof err === 'object' && err !== null) {
    const errorObj = err as { [key: string]: any };
    const message =
      errorObj['message'] || errorObj['error']?.message || 'Unknown error';
    return { message, data: errorObj['data'] || null };
  }

  return { message: 'Unknown error' };
}
