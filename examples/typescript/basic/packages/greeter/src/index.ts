export type Language = 'en' | 'es' | 'fr';

export interface Greeting {
  name: string;
  language: Language;
}

const greetings: Record<Language, string> = {
  en: 'Hello',
  es: 'Hola',
  fr: 'Bonjour',
};

export function greet({ name, language }: Greeting): string {
  return `${greetings[language]}, ${name}!`;
}
