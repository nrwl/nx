# Getting Started

Nx is a suite of powerful, extensible dev tools that help you develop, test, build, and scale Node applications.

## Create Nx Workspace

Creating an Nx workspace is easy. Run the following command to set up an Nx workspace with an NestJS app in it.

```bash
npx create-nx-workspace --preset=nest
```

To create an Nx workspace with an Express app run:

```bash
npx create-nx-workspace --preset=empty
```

cd into the folder and run:

```
npm i @nrwl/express
npx nx g @nrwl/express:app myapp
```

## Learn Nx Fundamentals

- [Interactive Nx Tutorial (with videos)](/{{framework}}/tutorial/01-create-application)
- [Free Nx Course on YouTube](https://www.youtube.com/watch?time_continue=49&v=2mYLe9Kp9VM&feature=emb_logo)

## Dive Deep

- [Nx CLI](/{{framework}}/getting-started/cli-overview)
- [Configuration Files](/{{framework}}/getting-started/configuration)
- [Computation Caching](/{{framework}}/core-concepts/computation-caching)
- [Rebuilding What is Affected](/{{framework}}/core-concepts/affected)
