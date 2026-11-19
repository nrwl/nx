import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

export const onRequest = defineRouteMiddleware((context) => {
  if (
    context.url.pathname === '/docs/kb' ||
    context.url.pathname.startsWith('/docs/kb/')
  ) {
    context.locals.starlightRoute.hasSidebar = false;
  }
});
