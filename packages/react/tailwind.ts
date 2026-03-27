throw new Error(
  `"@nx/react/tailwind" has been removed in Nx 23.\n\n` +
    `Tailwind CSS v4 no longer needs glob patterns for content detection.\n` +
    `Instead, add \`@source\` directives in your stylesheet that contains \`@import 'tailwindcss'\`.\n\n` +
    `Example:\n` +
    `  @import 'tailwindcss';\n` +
    `  @source '../../libs/shared/ui/src';\n\n` +
    `See: https://nx.dev/docs/technologies/react/guides/using-tailwind-css-in-react#configuring-sources-for-monorepos`
);
