import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { getCollection } from 'astro:content';

export const onRequest = defineRouteMiddleware(async (context) => {
  const { entry } = context.locals.starlightRoute;

  if (entry.data.banner) {
    return;
  }

  const bannerContent = await getCollection('notifications');

  if (bannerContent.length) {
    bannerContent.sort((a, b) =>
      new Date(b.data.date) > new Date(a.data.date) ? -1 : 1
    );

    const nextEventToOccur = bannerContent.at(-1);
    if (!nextEventToOccur || !nextEventToOccur.data.title) {
      return;
    }

    const title = nextEventToOccur.data.title.split(':')[0];
    // TODO(caleb): based on the 'type' we will render different markup for the banners
    //  i.e. type=webinar => "Register for the {title} webinar"
    //  type=event => "Join us for {title} on {date}"

    entry.data.banner = {
      content: `<a href="${nextEventToOccur.data.registrationUrl}" title="${nextEventToOccur.data.title}">${title}</a>`,
    };
  }
});
