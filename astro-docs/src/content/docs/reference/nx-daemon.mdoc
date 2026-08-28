---
title: Nx Daemon
description: Learn how the Nx Daemon watches workspace files and keeps project graph computation fast between commands.
sidebar:
  order: 6
filter: 'type:References'
---

The Nx Daemon is a background process that watches workspace files and keeps project graph data in
memory.
Each workspace starts its own daemon process, so multiple workspaces can use different Nx versions
without sharing daemon state.

## Why Nx uses a daemon

Nx needs the project graph before it can run targets or calculate affected projects.
Rebuilding the entire graph for every command becomes expensive as a workspace grows.

The daemon watches for file changes and updates the graph incrementally.
Because it already knows which files changed and retains graph state in memory, subsequent Nx commands
can request an up-to-date graph without starting the analysis from scratch.

{% aside type="note" title="Local communication" %}
On macOS and Linux, Nx communicates with the daemon through a Unix socket.
On Windows, it uses a named pipe.
{% /aside %}

The daemon shuts down after 3 hours without requests or file changes.
Run `nx reset` to stop it manually and clear other Nx workspace state.

## Disable the daemon

The daemon is enabled by default on local development machines.
Disable it for a workspace by setting `useDaemonProcess` in `nx.json`:

```jsonc title="nx.json"
{
  "useDaemonProcess": false,
}
```

Set `NX_DAEMON=false` to disable it for one command or environment.
The environment variable takes precedence over `nx.json`.

```shell
NX_DAEMON=false nx show projects
```

Nx disables the daemon by default in CI and containers, where its persistent state or file watching
isn't useful.
Set `NX_DAEMON=true` to opt in when a supported long-running environment can reuse the process.

In an AI agent sandbox the daemon runs, but the sandbox has to allow the unix sockets it creates.
See [Configure agent sandboxes for Nx](/docs/kb/nx-sandbox-unix-sockets).

Nx can't run the daemon in WebAssembly environments, so `NX_DAEMON=true` has no effect there.

## Inspect daemon logs

Run `nx daemon` to print the daemon process ID and log file path.
Open the file in your IDE or stream it from another terminal:

```shell
nx daemon
tail -f <daemon-log-path>
```

## Change the socket directory

On macOS and Linux, Nx tries three locations for the daemon socket and for the forked process and
plugin worker sockets, and uses the first one it can establish: `/tmp/.nx/<uid>/sockets`, then
`~/.nx/sockets`, then a directory inside the workspace.
Beneath the first two, Nx creates a directory only your user can reach, named per run for the daemon
and forked process sockets, and per workspace for the plugin worker sockets.
The workspace location is used directly rather than getting a directory beneath it, so sockets there are
per workspace whichever kind they are.
For what each location requires, see
[Fix Nx commands failing in an AI agent sandbox](/docs/kb/nx-sandbox-unix-sockets).

Setting `NX_SOCKET_DIR` does not add a fourth entry to that list. It replaces it.
The value becomes the socket directory itself rather than a root to create one under, and it gets no
fallback through the other locations: if Nx cannot use it you get the workspace directory and a
warning, and if it names a directory Nx refuses outright you get an error.

The stable `/tmp/.nx` and `~/.nx` prefixes are what an agentic coding sandbox allowlists.
The workspace location is the last resort and is different in kind: it sits outside those prefixes, and
its length grows with the depth of your checkout, so it's the one most likely to exceed the socket path
length limit.
Nx warns once per command when it lands there.

Windows named pipes are not files, so there is no shared directory to separate users in and no chain to
walk.
Nx places them directly in a per-run directory under `%TMP%`, which is already scoped to one account.

Override the location like this:

```shell
NX_SOCKET_DIR=<your-directory> nx daemon
```

This is primarily a workaround for file-permission issues with the default location, such as an
environment that restricts access to it or a socket path that exceeds the OS length limit.
Because the value is used as the socket directory itself, it has to name a directory only your user can
reach.
Nx rejects the system temp directory and its own container and cache roots.
Name a directory beneath an owner-only root instead.
`NX_SOCKET_DIR` takes precedence over the older `NX_DAEMON_SOCKET_DIR`.

{% aside type="caution" title="Never share the socket directory" %}
The socket is a remote for code execution: any process that reaches it can run code inside your
long-lived daemon.
Do not point `NX_SOCKET_DIR` (or `NX_DAEMON_SOCKET_DIR`) at a directory that other users, workspaces, or
containers can access, such as a world-writable temp directory.
Use a directory that only your user can reach.
The daemon also rejects messages stamped with a different workspace root, which detects two workspaces
accidentally sharing a socket directory.
{% /aside %}

## Daemon behavior in containers

Nx automatically disables the daemon in Docker containers and CI environments. The daemon's performance benefits come from maintaining state between commands and watching for file changes.
In ephemeral environments where each command runs in a fresh container, this state cannot be reused, so the overhead of starting a background process provides no benefit.

A persistent development container can benefit from the daemon, but check these constraints before
enabling it:

- Volume mounts can change file metadata in ways that affect file watching.
- Container restarts invalidate the daemon socket.
- Host and container permission differences can block socket access.

Give each container its own daemon.
Mounting one socket directory into several containers lets any of them run code in the others' daemons,
as described in [Change the socket directory](#change-the-socket-directory).

{% aside type="note" title="When to enable the daemon" %}
Enable the daemon only in a container that persists across multiple Nx commands.
Keep the default for short-lived or frequently restarted containers.
{% /aside %}
