---
title: Nx Daemon
description: Learn about the Nx Daemon, a background process that speeds up project graph computation in large workspaces by maintaining state between commands.
---

# Nx Daemon

In version 13 we introduced the opt-in Nx Daemon which Nx can leverage to dramatically speed up project graph computation, particularly for large workspaces.

## Why is it needed?

Every time you invoke a target directly, such as `nx test myapp`, or run affected commands, such `nx affected:test`, Nx first needs to generate a project graph in order to figure out how all the different projects and files within your workspace fit together. Naturally, the larger your workspace gets, the more expensive this project graph generation becomes.

Thankfully, because Nx stores its metadata on disk, Nx only recomputes what has changed since the last command invocation.

This helps quite a bit, but the recomputation is not very surgical because there is no way for Nx to know what kind of changes you have made, so it has to consider a wide range of possibilities when recomputing the project graph, even with the cache available.

## What is Nx Daemon

The Nx Daemon is a process which runs in the background on your local machine. There is one unique Nx Daemon per Nx workspace meaning if you have multiple Nx workspaces on your machine active at the same time, the corresponding Nx Daemon instances will operate independently of one another and can be on different versions of Nx.

{% callout type="note" title="Mac & Linux" %}
On macOS and linux, the server runs as a unix socket, and on Windows it runs as a named pipe.
{% /callout %}

The Nx Daemon is more efficient at recomputing the project graph because it watches the files in your workspaces and updates the project graph right away (intelligently throttling to ensure minimal recomputation). It also keeps everything in memory, so the response tends to be a lot faster.

In order to be most efficient, the Nx Daemon has some built in mechanisms to automatically shut down (including removing all file watchers) when it is not needed. These include:

- after 3 hours of inactivity (meaning the workspace's Nx Daemon did not receive any requests or detect any file changes in that time)
- when the Nx installation changes

If you ever need to manually shut down the Nx Daemon, you can run `nx reset` within the workspace in question.

## Turning it Off

The Nx Daemon is enabled by default when running on your local machine. If you want to turn it off

- set `useDaemonProcess: false` in the runners options in `nx.json` or
- set the `NX_DAEMON` env variable to `false`.

When using Nx in a CI environment, the Nx Daemon is disabled by default. Whether the process runs is determined by the following function: [https://github.com/nrwl/nx/blob/master/packages/nx/src/utils/is-ci.ts](https://github.com/nrwl/nx/blob/master/packages/nx/src/utils/is-ci.ts)

## Logs

To see information about the running Nx Daemon (such as its background process ID and log output file), run `nx daemon`. Once you have the path to that log file, you could either open it in your IDE or stream updates in a separate terminal window by running `tail -f {REPLACE_WITH_LOG_PATH}`, for example.

## Customizing the socket location

The Nx Daemon uses a unix socket to communicate between the daemon and the Nx processes. By default this socket gets placed in a temp directory. If you are using Nx in a docker-compose environment, however, you may want to run the daemon manually
and control its location to enable sharing the daemon among your docker containers. To do so, simply set the NX_DAEMON_SOCKET_DIR environment variable to a shared directory.
