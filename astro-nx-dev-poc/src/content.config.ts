import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { PluginLoader } from './plugins/loaders/plugin-loader';
import { CliLoader } from './plugins/loaders/cli-loader';

// Default docs collection handled by Starlight
const docs = defineCollection({
  loader: docsLoader(),
  schema: docsSchema(),
});

const nxCliDocs = defineCollection({
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
});

const pluginDocs = defineCollection({
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
});

export const collections = {
  docs,
  'nx-cli-docs': nxCliDocs,
  'plugin-docs': pluginDocs,
};
