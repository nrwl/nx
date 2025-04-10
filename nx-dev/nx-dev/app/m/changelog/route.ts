import { NextResponse } from 'next/server';
import { changeLogApi } from '../../../lib/changelog.api';
import { rewriteMarkdownLinks } from '../../../lib/markdown-utils';

export async function GET(request: Request) {
  try {
    // Get the changelog entries
    const entries = changeLogApi.getChangelogEntries();

    // Create a markdown document from the entries
    let content = '# Nx Changelog\n\n';

    // Add entries to the content in markdown format
    entries.forEach((entry) => {
      content += `## ${entry.version}\n\n`;
      if (entry.content) {
        // Add processed content
        content += rewriteMarkdownLinks(entry.content) + '\n\n';
      }
    });

    // Return the processed markdown content with proper headers
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': 'inline; filename="changelog.md"',
      },
    });
  } catch (error) {
    // Return a markdown 404 message
    return new NextResponse(
      `# Not Found\n\nThe changelog could not be found.`,
      {
        status: 404,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
        },
      }
    );
  }
}

// Make this route static at build time for performance
export const dynamic = 'force-static';
