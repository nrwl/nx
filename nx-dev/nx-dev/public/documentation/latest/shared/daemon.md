# Nx Daemon

In version 13 we introduced the opt-in Nx Daemon which Nx can leverage to dramatically speed up project graph computation, particularly for large workspaces.

## Why is it needed?

Every time you invoke a target directly, such as `nx test myapp`, or run affected commands, such `nx affected:test`, Nx first needs to generate a project graph in order to figure out how all the different projects and files within your workspace fit together. Naturally, the larger your workspace gets, the more expensive this project graph generation becomes.

The first time you ever run a command which requires the project graph will naturally be the most computationally expensive, but Nx has long been able to improve the performance of subsequent project graph creation operations thanks to the fact it will cache its existing knowledge by writing files to disk. This helps quite a bit, but the recomputation is not very surgical because there is no way for the Nx CLI to know what kind of changes you might have made since the last command was run and so it has to consider a wide range of possibilities when recomputing the project graph, even with the cache available.

If there were a way for the Nx CLI to keep up with changes _as you made them_ then it could be much more surgical with recomputation of the project graph, and therefore much faster...

This is exactly what the Nx Daemon does.

## How does it work?

The Nx Daemon is a server which runs in the background, exclusively on your local machine. There is one unique Nx Daemon per Nx workspace meaning if you have multiple Nx workspaces on your machine active at the same time, the corresponding Nx Daemon instances will operate independently from one another and can be on different versions of Nx.

> On macOS and linux, the server runs as a unix socket, and on Windows it runs as a named pipe.

When it is running and opted into by the user, it is used as the source of truth for the workspace's project graph, because as well as being able to compute the full thing from scratch it is capable of _maintaining_ the project graph over time as changes are made in your workspace. It does this by watching for changes to the files in your workspace (intelligently throttling to ensure minimal recomputation when changing lots of files) and keeps everything within the memory of the server process, so responses can be super fast, even instant, when the project graph is unchanged between `nx ...` cli commands.

In order to be most efficient, the Nx Daemon has some built in mechanisms to automatically shut down (including removing all file watchers) when it is not needed. These include:

- after 3 hours of inactivity (meaning the workspace's Nx Daemon did not receive any requests or detect any file changes in that time)
- when the Nx installation changes (e.g. when you run `nx migrate`)

If you ever need to manually shut down the Nx Daemon, you can run `nx reset` within the workspace in question. This will also clear any cached artifacts for the workspace and should rarely, if ever, be needed.

## How can it be used?

As of v13.0.0, the Nx Daemon is an opt-in feature while we gather real-world feedback. At Nrwl, we are already actively using it on our internal and client workspaces and have seen some huge performance increases for project graph computation on very large workspaces. We encourage you to consider enabling it on your workspace by following the instructions below:

- To opt in to using the Nx Daemon, simply set `useDeamonProcess: true` in the runners options in nx.json.

- To see information about the running Nx Daemon (such as its background process ID and log output file), run `nx daemon --help`. Once you have the path to that log file, you could either open it in your IDE or stream updates in a separate terminal window by running `tail -f {REPLACE_WITH_LOG_PATH}`, for example.
