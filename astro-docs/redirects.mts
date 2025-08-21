export const redirects = {
  '/': '/docs/getting-started/intro',
  '/showcase': '/docs/quickstart',
  // astro doesn't seem to  allow configuing catch all redirect routes
  // so hard code each previous route to the redirect for now
  // '/showcase/[...slug]': '/quickstart',
  '/showcase/example-repos': '/docs/quickstart',
  '/showcase/example-repos/add-express': '/docs/quickstart',
  '/showcase/example-repos/add-lit': '/docs/quickstart',
  '/showcase/example-repos/add-solid': '/docs/quickstart',
  '/showcase/example-repos/add-qwik': '/docs/quickstart',
  '/showcase/example-repos/add-rust': '/docs/quickstart',
  '/showcase/example-repos/add-dotnet': '/docs/quickstart',
  '/showcase/example-repos/add-astro': '/docs/quickstart',
  '/showcase/example-repos/add-svelte': '/docs/quickstart',
  '/showcase/example-repos/add-fastify': '/docs/quickstart',
  '/showcase/example-repos/apollo-react': '/docs/quickstart',
  '/showcase/example-repos/nestjs-prisma': '/docs/quickstart',
  '/showcase/example-repos/mongo-fastify': '/docs/quickstart',
  '/showcase/example-repos/redis-fastify': '/docs/quickstart',
  '/showcase/example-repos/postgres-fastify': '/docs/quickstart',
  '/showcase/example-repos/serverless-fastify-planetscale': '/docs/quickstart',
  '/showcase/example-repos/mfe': '/docs/quickstart',
  '/showcase/benchmarks': '/docs/references/benchmarks',
  '/showcase/benchmarks/tsc-batch-mode':
    '/docs/references/benchmarks/tsc-batch-mode',
  '/showcase/benchmarks/caching': '/docs/references/benchmarks/caching',
  '/showcase/benchmarks/nx-agents': '/docs/references/benchmarks/nx-agents',
};
