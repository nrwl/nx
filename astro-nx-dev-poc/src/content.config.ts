import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { PluginLoader } from './loaders/plugin-loader';
import { CliLoader } from './loaders/cli-loader';

export const collections = {
  // Default docs collection handled by Starlight
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema(),
  }),

  // Custom collection for CLI docs
  'cli-docs': defineCollection({
    loader: CliLoader(),
    schema: z.object({
      title: z.string(),
      docType: z.literal('cli'),
      content: z.string(),
      headings: z
        .array(
          z.object({
            depth: z.number(),
            slug: z.string(),
            text: z.string(),
          })
        )
        .optional(),
    }),
  }),

  // Custom collection for plugin docs
  'plugin-docs': defineCollection({
    loader: PluginLoader(),
    schema: z.object({
      title: z.string(),
      pluginName: z.string(),
      packageName: z.string(),
      docType: z.enum(['generators', 'executors', 'migrations']),
      content: z.string(),
      headings: z
        .array(
          z.object({
            depth: z.number(),
            slug: z.string(),
            text: z.string(),
          })
        )
        .optional(),
    }),
  }),
};
