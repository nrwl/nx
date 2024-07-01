import { defineEventHandler, getQuery } from 'h3';

export default defineEventHandler((event) => {
  const q = getQuery(event);
  const projectName = q.name || 'World';

  return {
    message: `Hello ${projectName}`,
  };
});
