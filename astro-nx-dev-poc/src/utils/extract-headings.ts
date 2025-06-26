export interface Heading {
  depth: number;
  slug: string;
  text: string;
}

// Shared function to create consistent slugs
export function createSlug(text: string | any): string {
  // Ensure text is a string
  const textStr = typeof text === 'string' ? text : String(text);

  return textStr
    .toLowerCase()
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/`/g, '') // Remove backticks
    .replace(/\*/g, '') // Remove asterisks
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim();
}

export function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    // Match markdown headings (##, ###, etc.)
    const match = line.match(/^(#{2,6})\s+(.+)$/);
    if (match) {
      const depth = match[1].length;
      const text = match[2].trim();

      // Create slug using the shared function
      const slug = createSlug(text);

      headings.push({
        depth,
        slug,
        text: text.replace(/`/g, ''), // Remove backticks for display
      });
    }
  }

  return headings;
}
