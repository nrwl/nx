import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  // Default docs collection handled by Starlight
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema(),
  }),

  // Custom collection for CLI docs
  'cli-docs': defineCollection({
    loader: async () => {
      // TODO: Implement CLI documentation loader
      //   const { generateNxCliDocs } = await import('./loaders/cli-loader');
      //   const cliDocs = await generateNxCliDocs();
      return [
        {
          id: 'nx-cli',
          title: 'Nx CLI',
          description: 'Complete reference for all Nx CLI commands',
          content: 'blah',
        },
      ];
    },
    schema: z.object({
      title: z.string(),
      description: z.string(),
      content: z.string(),
    }),
  }),

  // Custom collection for plugin docs
  'plugin-docs': defineCollection({
    loader: async () => {
      // TODO: Implement plugin documentation loader
      const { generateAllPluginDocs } = await import('./loaders/plugin-loader');
      return await generateAllPluginDocs();
    },
    schema: z.object({
      title: z.string(),
      pluginName: z.string(),
      packageName: z.string(),
      docType: z.enum(['generators', 'executors', 'migrations']),
      content: z.string(),
    }),
  }),
};
