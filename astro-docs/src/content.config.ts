import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { file } from 'astro/loaders';
import { PluginLoader } from './plugins/plugin.loader';
import { NxReferencePackagesLoader } from './plugins/nx-reference-packages.loader';
import { CommunityPluginsLoader } from './plugins/community-plugins.loader';

const baseSchema = z.object({
  title: z.string(),
  /**
   * Slug should be from the root route without any prefix requirements i.e. `/docs`
   **/
  slug: z.string(),
});
// Default docs collection handled by Starlight
const docs = defineCollection({
  loader: docsLoader(),
  schema: docsSchema(),
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

// general notification collection for showing time based notifications
//  in app, i.e. webinars, or confs etc.
// goal is that different pages/parts of the app can query for their specific needs.
// i.e. show banner for webinar, or show a dynamic sidebars item for a conf signups etc.
const notifications = defineCollection({
  loader: file('src/content/notifications.json'),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    // TODO(caleb): should parse this to a date object
    date: z.string(),
    // slug will be dismiss key for the banner
    slug: z.string(),
    authors: z.array(z.string()),
    // these have to contain the tag webinar??
    type: z.enum(['webinar', 'event', 'release']),
    cover_image: z.string(),
    // tbf this can probs be derived if given a full timestamp for `date`
    time: z.string(),
    // TODO(caleb); get all possible statues, some of these could be derived such as 'Upcoming' or 'Past - *'
    //  we just really want to know if something is gated or not etc
    status: z.enum(['Upcoming', 'Past - Gated']),
    registrationUrl: z.string(),
  }),
});

export const collections = {
  docs,
  notifications,
  'nx-reference-packages': nxReferencePackages,
  'plugin-docs': pluginDocs,
  'community-plugins': communityPlugins,
};
