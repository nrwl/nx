import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { readFileSync, existsSync } from 'node:fs';

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;

  // Only read raw content if the entry has a file path on disk
  if (route?.entry?.filePath && existsSync(route.entry.filePath)) {
    try {
      context.locals.rawContent = readFileSync(route.entry.filePath, 'utf-8');
    } catch (error) {
      console.error('Failed to read raw content:', error);
    }
  }
});
