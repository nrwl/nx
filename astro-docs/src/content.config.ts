import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { file } from 'astro/loaders';
import { PluginLoader } from './plugins/plugin.loader';
import { NxReferencePackagesLoader } from './plugins/nx-reference-packages.loader';
import { CommunityPluginsLoader } from './plugins/community-plugins.loader';

// Compose with `.extend()`, never `.and()`. Zod 4 drops the left-hand side of a nested
// intersection, so passing an intersection as `docsSchema({ extend })` silently loses
// Starlight's own fields - including the `head` default that page rendering requires.
const customDocsSchema = z.object({
  title: z.string(),
  description: z.string(),
  featured: z.boolean().optional(),
  topics: z.array(z.string()).optional(),
  weight: z
    .number()
    .min(0, 'Search weight cannot be lower than 0')
    .max(10, 'Search weight cannot be higher than 10')
    .optional(),
  filter: z
    .enum(['type:Concepts', 'type:Features', 'type:Guides', 'type:References'])
    .optional(),
});

const baseSchema = customDocsSchema.extend({
  /**
   * Slug should be from the root route without any prefix requirements i.e. `/docs`
   **/
  slug: z.string(),
});

// Default docs collection handled by Starlight
const docs = defineCollection({
  loader: docsLoader(),
  schema: docsSchema({
    extend: customDocsSchema,
  }),
});

const nxReferencePackages = defineCollection({
  loader: NxReferencePackagesLoader(),
  schema: baseSchema.extend({
    packageType: z.enum([
      'cnw',
      'devkit',
      'nx-cli',
      'nx',
      'plugin',
      'web',
      'workspace',
    ]),
    docType: z.string(), // 'overview', 'generators', 'executors', 'cli', 'migrations', 'devkit', 'ngcli_adapter', etc.
    category: z.string().optional(),
    kind: z.string().optional(),
    features: z.array(z.string()).optional(),
    totalDocs: z.number().optional(),
    npmDownloads: z.number().optional(),
    githubStars: z.number().optional(),
    lastPublishedDate: z.date().optional(),
    lastFetched: z.date().optional(),
  }),
});

const pluginDocs = defineCollection({
  loader: PluginLoader(),
  schema: baseSchema.extend({
    pluginName: z.string(),
    packageName: z.string(),
    docType: z.enum(['generators', 'executors', 'migrations', 'overview']),
    technologyCategory: z.string(),
    features: z.array(z.string()).optional(),
    totalDocs: z.number().optional(),
    description: z.string(),
    npmDownloads: z.number().optional(),
    githubStars: z.number().optional(),
    lastPublishedDate: z.date().optional(),
    lastFetched: z.date().optional(),
  }),
});

const communityPlugins = defineCollection({
  loader: CommunityPluginsLoader(),
  schema: baseSchema.extend({
    // community plugins don't have title currently; derive from slug
    description: z.string(),
    url: z.string(),
    lastPublishedDate: z.date().optional(),
    npmDownloads: z.number().optional(),
    githubStars: z.number().optional(),
    nxVersion: z.string().optional(),
    lastFetched: z.date().optional(),
  }),
});

// Banner collection for showing time-based notifications (webinars, events, etc.)
const banner = defineCollection({
  loader: file('src/content/banner.json'),
  schema: z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    artwork: z.string().optional(),
    primaryCtaUrl: z.string(),
    primaryCtaText: z.string(),
    secondaryCtaUrl: z.string().optional(),
    secondaryCtaText: z.string().optional(),
    activeUntil: z.string(),
  }),
});

export const collections = {
  docs,
  banner,
  'nx-reference-packages': nxReferencePackages,
  'plugin-docs': pluginDocs,
  'community-plugins': communityPlugins,
};
