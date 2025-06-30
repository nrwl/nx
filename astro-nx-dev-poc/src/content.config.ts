import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { PluginLoader } from './plugins/loaders/plugin-loader';
import { CliLoader } from './plugins/loaders/cli-loader';
import { DevKitLoader } from './plugins/loaders/devkit-loader';
import { file } from 'astro/loaders';

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
  }),
});

const devkitDocs = defineCollection({
  loader: DevKitLoader(),
  schema: z.object({
    title: z.string(),
    docType: z.literal('devkit'),
    content: z.string().optional(),
    category: z.string().optional(),
    kind: z.string().optional(),
  }),
});

const webinars = defineCollection({
  // TODO(caleb): any extra parsing we need to do? i.e. date time/derived values
  loader: file('src/content/webinars.json'),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    // TODO(caleb): should parse this to a date object
    date: z.string(),
    // slug will be dismiss key for the banner
    slug: z.string(),
    authors: z.array(z.string()),
    // these have to contain the tag webinar??
    tags: z.array(z.string()),
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
  webinars,
  'nx-cli-docs': nxCliDocs,
  'plugin-docs': pluginDocs,
  'devkit-docs': devkitDocs,
};
