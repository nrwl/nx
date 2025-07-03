import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { PluginLoader } from './plugins/plugin.loader';
import { CliLoader } from './plugins/cli.loader';
import { DevkitLoader } from './plugins/devkit.loader';
import { file } from 'astro/loaders';
import { CnwLoader } from './plugins/cnw.loader.ts';

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
  }),
});

const pluginDocs = defineCollection({
  loader: PluginLoader(),
  schema: z.object({
    title: z.string(),
    pluginName: z.string(),
    packageName: z.string(),
    docType: z.enum(['generators', 'executors', 'migrations']),
    description: z.string(),
  }),
});

const devkitDocs = defineCollection({
  loader: DevkitLoader(),
  schema: z.object({
    title: z.string(),
    docType: z.enum(['devkit', 'ngcli_adapter']),
    description: z.string().optional(),
    category: z.string().optional(),
    kind: z.string().optional(),
  }),
});

const cnwDocs = defineCollection({
  loader: CnwLoader(),
  schema: z.object({
    title: z.string(),
    docType: z.enum(['cnw']),
  }),
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
  'nx-cli-docs': nxCliDocs,
  'plugin-docs': pluginDocs,
  'devkit-docs': devkitDocs,
  'cnw-docs': cnwDocs,
};
