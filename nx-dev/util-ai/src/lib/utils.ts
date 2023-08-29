import { ChatCompletionRequestMessageRoleEnum } from 'openai';

export function checkEnvVariables(
  openAiKey?: string,
  supabaseUrl?: string,
  supabaseServiceKey?: string
) {
  if (!openAiKey) {
    throw new CustomError(
      'application_error',
      'Missing environment variable NX_OPENAI_KEY',
      {
        missing_key: true,
      }
    );
  }

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
  similarity: number;
  slug: string;
  url_partial: string | null;
}

export interface ChatItem {
  role: ChatCompletionRequestMessageRoleEnum;
  content: string;
}
