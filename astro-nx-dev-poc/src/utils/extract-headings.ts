export interface Heading {
  depth: number;
  slug: string;
  text: string;
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
      
      // Remove backticks and other markdown formatting for the slug
      const cleanText = text.replace(/`/g, '').replace(/\*/g, '');
      const slug = cleanText
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .trim();
      
      headings.push({
        depth,
        slug,
        text: text.replace(/`/g, ''), // Remove backticks for display
      });
    }
  }
  
  return headings;
}