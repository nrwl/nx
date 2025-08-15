export const redirects = {
  '/': '/getting-started/intro',
  '/showcase': '/quickstart',
  // astro doesn't seem to  allow configuing catch all redirect routes
  // so hard code each previous route to the redirect for now
  // '/showcase/[...slug]': '/quickstart',
  '/showcase/example-repos': '/quickstart',
  '/showcase/example-repos/add-express': '/quickstart',
  '/showcase/example-repos/add-lit': '/quickstart',
  '/showcase/example-repos/add-solid': '/quickstart',
  '/showcase/example-repos/add-qwik': '/quickstart',
  '/showcase/example-repos/add-rust': '/quickstart',
  '/showcase/example-repos/add-dotnet': '/quickstart',
  '/showcase/example-repos/add-astro': '/quickstart',
  '/showcase/example-repos/add-svelte': '/quickstart',
  '/showcase/example-repos/add-fastify': '/quickstart',
  '/showcase/example-repos/apollo-react': '/quickstart',
  '/showcase/example-repos/nestjs-prisma': '/quickstart',
  '/showcase/example-repos/mongo-fastify': '/quickstart',
  '/showcase/example-repos/redis-fastify': '/quickstart',
  '/showcase/example-repos/postgres-fastify': '/quickstart',
  '/showcase/example-repos/serverless-fastify-planetscale': '/quickstart',
  '/showcase/example-repos/mfe': '/quickstart',
  '/showcase/benchmarks': '/references/benchmarks',
  '/showcase/benchmarks/tsc-batch-mode':
    '/references/benchmarks/tsc-batch-mode',
  '/showcase/benchmarks/caching': '/references/benchmarks/caching',
  '/showcase/benchmarks/nx-agents': '/references/benchmarks/nx-agents',
};
