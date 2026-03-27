throw new Error(
  `"@nx/angular/tailwind" has been removed in Nx 23.\n\n` +
    `Tailwind CSS v4 no longer needs glob patterns for content detection.\n` +
    `Instead, add \`@source\` directives in your stylesheet that contains \`@import 'tailwindcss'\`.\n\n` +
    `Example:\n` +
    `  @import 'tailwindcss';\n` +
    `  @source '../../libs/shared/ui/src';\n\n` +
    `See: https://nx.dev/docs/technologies/angular/guides/using-tailwind-css-with-angular`
);
