<div align="center">

  <p>
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="images/nx-logo-light.svg">
      <img src="images/nx-logo.svg" alt="Nx Logo" width="140">
    </picture>
  </p>

  <h1 align="center">Smart Monorepos · Fast Builds</h1>

  <p>
    <a href="https://www.npmjs.com/package/nx"><img src="https://img.shields.io/npm/v/nx.svg?style=for-the-badge" alt="NPM Version"></a>
    <a href="https://github.com/nrwl/nx"><img src="https://img.shields.io/github/stars/nrwl/nx?style=for-the-badge&logo=github" alt="GitHub Stars"></a>
    <a href=""><img src="https://img.shields.io/npm/l/nx.svg?style=for-the-badge" alt="License"></a>
    <a href="https://go.nx.dev/community"><img src="https://img.shields.io/discord/1143497901675401286?label=discord&style=for-the-badge" alt="Discord"></a>
    <a href="https://x.com/nxdevtools"><img src="https://img.shields.io/badge/@nxdevtools-555?style=for-the-badge&logo=x" alt="X (Twitter)"></a>
  </p>

 <br />

[**Docs**](https://nx.dev/docs) &nbsp;&bull;&nbsp; [**Changelog**](https://nx.dev/changelog) &nbsp;&bull;&nbsp; [**Blog**](https://nx.dev/blog) &nbsp;&bull;&nbsp; [**Courses**](https://nx.dev/courses) &nbsp;&bull;&nbsp; [**YouTube**](https://youtube.com/@nxdevtools)

<br />

</div>

Nx is a monorepo solution for TypeScript and polyglot codebases. Built with Rust for performance, extensible via TypeScript. Caches what didn't change, runs only what's affected, and comes with an integrated CI solution. Start simple, scale as you grow.

## Quick Start

Visit the [Nx quickstart docs](https://nx.dev/docs/quickstart) to get started.

## Why Nx?

- **Incremental by design -** Run `npx nx init` in any npm/pnpm/yarn workspace. Nx picks up your existing `package.json` scripts, caches their outputs, and runs only what's
  affected. No changes to your setup required.
- **AI-native tooling -** The Nx CLI is optimized for autonomous AI agents so they get the context they need and can operate just like a human. [Learn more &raquo;](https://github.com/nrwl/nx-ai-agents-config)
- **Polyglot plugin system -** Optional plugins auto-discover tasks, configure cache inputs/outputs, and scaffold code based on your actual tooling. Works with Vite, Webpack, Jest, Vitest, ESLint, Gradle, Maven, .NET, Go, and [more](https://nx.dev/technologies).
- **Integrated CI solution -** [Connect Nx to your CI provider](https://nx.dev/ci/intro/ci-with-nx) (GitHub Actions, GitLab, Azure, etc.) to enable remote caching, task distribution across machines, affected-only runs, and automatic e2e test splitting. [Learn more &raquo;](https://nx.dev/ci/intro/ci-with-nx)
- **Self-healing CI -** An AI agent on your CI pipeline that detects failures, analyzes root cause, proposes a fix, and verifies it automatically. Local agents connect to CI via MCP to autonomously detect and fix failures. [Learn more &raquo;](https://nx.dev/ci/features/self-healing)

## Who uses Nx?

From startups to Fortune 500 companies. [See our Nx success stories &raquo;](https://nx.dev/customers)

## Want to help?

If you want to file a bug or submit a PR, read up on our [guidelines for contributing](https://github.com/nrwl/nx/blob/master/CONTRIBUTING.md).

## Core Team

| Victor Savkin                                                          | Jason Jean                                                            | Benjamin Cabanes                                                            | Jack Hsu                                                          |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| ![Victor Savkin](https://avatars1.githubusercontent.com/u/35996?s=160) | ![Jason Jean](https://avatars2.githubusercontent.com/u/8104246?s=160) | ![Benjamin Cabanes](https://avatars2.githubusercontent.com/u/3447705?s=160) | ![Jack Hsu](https://avatars0.githubusercontent.com/u/53559?s=160) |
| [vsavkin](https://github.com/vsavkin)                                  | [FrozenPandaz](https://github.com/FrozenPandaz)                       | [bcabanes](https://github.com/bcabanes)                                     | [jaysoo](https://github.com/jaysoo)                               |

| James Henry                                                              | Jon Cammisuli                                                            | Max Kless                                                            | Juri Strumpflohner                                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| ![James Henry](https://avatars.githubusercontent.com/u/900523?s=160&v=4) | ![Jon Cammisuli](https://avatars2.githubusercontent.com/u/4332460?s=160) | ![Max Kless](https://avatars.githubusercontent.com/u/34165455?s=160) | ![Juri Strumpflohner](https://avatars1.githubusercontent.com/u/542458?s=160) |
| [JamesHenry](https://github.com/JamesHenry)                              | [cammisuli](https://github.com/cammisuli)                                | [MaxKless](https://github.com/MaxKless)                              | [juristr](https://github.com/juristr)                                        |

| Philip Fulcher                                                            | Caleb Ukle                                                            | Colum Ferry                                                            | Steven Nance                                                           |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| ![Philip Fulcher](https://avatars1.githubusercontent.com/u/1536471?s=160) | ![Caleb Ukle](https://avatars.githubusercontent.com/u/23272162?s=160) | ![Colum Ferry](https://avatars.githubusercontent.com/u/12140467?s=160) | ![Steven Nance](https://avatars.githubusercontent.com/u/1036428?s=160) |
| [philipjfulcher](https://github.com/philipjfulcher)                       | [barbados-clemens](https://github.com/barbados-clemens)               | [Coly010](https://github.com/Coly010)                                  | [llwt](https://github.com/llwt)                                        |

| Miroslav Jonaš                                                          | Leosvel Pérez Espinosa                                                            | Zachary DeRose                                                           | Craigory Coppola                                                           |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| ![Miroslav Jonaš](https://avatars.githubusercontent.com/u/881612?s=160) | ![Leosvel Pérez Espinosa](https://avatars.githubusercontent.com/u/12051310?s=160) | ![Zachary DeRose](https://avatars.githubusercontent.com/u/3788405?s=160) | ![Craigory Coppola](https://avatars.githubusercontent.com/u/6933928?s=160) |
| [meeroslav](https://github.com/meeroslav)                               | [leosvelperez](https://github.com/leosvelperez)                                   | [ZackDeRose](https://github.com/ZackDeRose)                              | [AgentEnder](https://github.com/AgentEnder)                                |

| Chau Tran                                                            | Nicole Oliver                                                           | Rares Matei                                                           | Altan Stalker                                                           |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| ![Chau Tran](https://avatars.githubusercontent.com/u/25516557?s=160) | ![Nicole Oliver](https://avatars.githubusercontent.com/u/4440385?s=160) | ![Rares Matei](https://avatars.githubusercontent.com/u/5975076?s=160) | ![Altan Stalker](https://avatars.githubusercontent.com/u/6324206?s=160) |
| [nartc](https://github.com/nartc)                                    | [nixallover](https://github.com/nixallover)                             | [rarmatei](https://github.com/rarmatei)                               | [StalkAltan](https://github.com/StalkAltan)                             |

| Josh VanAllen                                                           | Austin Fahsl                                                           | Louie Weng                                                            |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| ![Josh VanAllen](https://avatars.githubusercontent.com/u/5290334?s=160) | ![Austin Fahsl](https://avatars.githubusercontent.com/u/6913035?s=160) | ![Louie Weng](https://avatars.githubusercontent.com/u/56288712?s=160) |
| [joshvanallen](https://github.com/joshvanallen)                         | [fahslaj](https://github.com/fahslaj)                                  | [lourw](https://github.com/lourw)                                     |
