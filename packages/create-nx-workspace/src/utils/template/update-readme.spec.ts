import { updateReadmeContent } from './update-readme';

describe('updateReadmeContent', () => {
  it('should return original content if markers are not present and no URL', () => {
    const content = '# My Workspace';
    const result = updateReadmeContent(content, undefined);
    expect(result).toBe(content);
  });

  it('should return original content if markers are not present', () => {
    const content = '# My Workspace\n\nSome content here.';
    const result = updateReadmeContent(
      content,
      'https://cloud.nx.app/connect/abc123'
    );
    expect(result).toBe(content);
  });

  it('should return original content if END marker is missing', () => {
    const content = '# My Workspace\n\n<!-- BEGIN: nx-cloud -->\nSome content.';
    const result = updateReadmeContent(
      content,
      'https://cloud.nx.app/connect/abc123'
    );
    expect(result).toBe(content);
  });

  it('should return original content if BEGIN marker is missing', () => {
    const content = '# My Workspace\n\n<!-- END: nx-cloud -->\nSome content.';
    const result = updateReadmeContent(
      content,
      'https://cloud.nx.app/connect/abc123'
    );
    expect(result).toBe(content);
  });

  it('should strip markers and insert section with connect URL', () => {
    const content = `# My Workspace

Some intro content.

<!-- BEGIN: nx-cloud -->
Old placeholder content here.
<!-- END: nx-cloud -->

## Other Section

More content.`;

    const result = updateReadmeContent(
      content,
      'https://cloud.nx.app/connect/abc123'
    );

    expect(result).toMatchInlineSnapshot(`
      "# My Workspace

      Some intro content.

      ## Finish your Nx platform setup

      🚀 [Finish setting up your workspace](https://cloud.nx.app/connect/abc123) to get faster builds with remote caching, distributed task execution, and self-healing CI. [Learn more about Nx Cloud](https://nx.dev/ci/intro/why-nx-cloud).

      ## Other Section

      More content."
    `);
  });

  it('should strip markers and content when no connect URL provided', () => {
    const content = `# My Workspace

Some intro content.

<!-- BEGIN: nx-cloud -->
Placeholder content to remove.
<!-- END: nx-cloud -->

## Other Section

More content.`;

    const result = updateReadmeContent(content, undefined);

    expect(result).toMatchInlineSnapshot(`
      "# My Workspace

      Some intro content.

      ## Other Section

      More content."
    `);
  });

  it('should handle markers with empty content between them', () => {
    const content = `# Test

<!-- BEGIN: nx-cloud -->
<!-- END: nx-cloud -->

Footer.`;

    const result = updateReadmeContent(
      content,
      'https://staging.nx.app/connect/pkjwpKplOJ'
    );

    expect(result).toMatchInlineSnapshot(`
      "# Test

      ## Finish your Nx platform setup

      🚀 [Finish setting up your workspace](https://staging.nx.app/connect/pkjwpKplOJ) to get faster builds with remote caching, distributed task execution, and self-healing CI. [Learn more about Nx Cloud](https://nx.dev/ci/intro/why-nx-cloud).

      Footer."
    `);
  });
});
