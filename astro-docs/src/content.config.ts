import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { file } from 'astro/loaders';
import { PluginLoader } from './plugins/plugin.loader';
import { NxReferencePackagesLoader } from './plugins/nx-reference-packages.loader';
import { CommunityPluginsLoader } from './plugins/community-plugins.loader';

const searchSchema = z.object({
  weight: z
    .number()
    .min(0, 'Search weight cannot be lower than 0')
    .max(10, 'Search weight cannot be higher than 10')
    .optional(),
  filter: z.string().optional(),
});

const customDocsSchema = z
  .object({
    title: z.string(),
    description: z.string(),
  })
  .and(searchSchema);

const baseSchema = z
  .object({
    /**
     * Slug should be from the root route without any prefix requirements i.e. `/docs`
     **/
    slug: z.string(),
  })
  .and(customDocsSchema);

// Default docs collection handled by Starlight
const docs = defineCollection({
  loader: docsLoader(),
  schema: docsSchema({
    extend: customDocsSchema,
  }),
});

const nxReferencePackages = defineCollection({
  loader: NxReferencePackagesLoader(),
  schema: baseSchema.and(
    z.object({
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
      description: z.string().optional(),
      category: z.string().optional(),
      kind: z.string().optional(),
      features: z.array(z.string()).optional(),
      totalDocs: z.number().optional(),
      npmDownloads: z.number().optional(),
      githubStars: z.number().optional(),
      lastPublishedDate: z.date().optional(),
      lastFetched: z.date().optional(),
    })
  ),
});

const pluginDocs = defineCollection({
  loader: PluginLoader(),
  schema: baseSchema.and(
    z.object({
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
    })
  ),
});

const communityPlugins = defineCollection({
  loader: CommunityPluginsLoader(),
  schema: baseSchema.and(
    z.object({
      // community plugins don't have title currently; derive from slug
      description: z.string(),
      url: z.string(),
      lastPublishedDate: z.date().optional(),
      npmDownloads: z.number().optional(),
      githubStars: z.number().optional(),
      nxVersion: z.string().optional(),
      lastFetched: z.date().optional(),
    })
  ),
});

// Banner collection for showing time-based notifications (webinars, events, etc.)
const banner = defineCollection({
  loader: file('src/content/banner.json'),
  schema: z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    description: z.string(),
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
