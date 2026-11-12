# Spike: tracking file reads of spawned process trees

Question: can we see which files a process we spawn (and its children) reads, on every
platform, cheaply, without elevated permissions?

Short answer: **yes on all three, each run for real: Linux in a microVM, macOS on an M-series
Mac, Windows in an ARM64 VM.** macOS loses tracing below SIP-protected binaries, and Windows
loses it for children of a different architecture. There is no single cross-platform mechanism; it is one small injected
library per OS behind a common napi-rs API, plus an optional kernel-level backstop on Linux.

## What is here

| Path | What |
| --- | --- |
| `shim/` | Rust `cdylib` injected into the child tree. Wraps `open`/`openat`/`fopen` (+ glibc `64`/`_2` variants) and appends one line per successful read-open to `$FSTRACE_OUT`. Linux via `LD_PRELOAD`; macOS via `DYLD_INSERT_LIBRARIES` + `__interpose`. |
| `addon/` | napi-rs addon: `traceSpawn(cmd, args, { backend, shimPath, cwd }) → Promise<{ exitCode, reads, events }>`. |
| `addon/src/seccomp.rs` | Linux-only backend using seccomp user notification. |
| `demo.mjs` | Coverage matrix: which backend sees which kind of reader. |
| `bench.mjs` | Overhead per backend (`strace` included as a ptrace yardstick). |
| `demo-macos.mjs`, `bench-macos.mjs` | The same checks for the preload backend on macOS. |
| `shim-macos/`, `sip/`, `demo-sip.ts`, `bench-sip.ts` | macOS C shim with the SIP exec rewrite, the copy-directory helper, and its checks. See "macOS: tracing past SIP". |
| `windows/` | C tracer for Windows: `fstrace.exe` launcher, `fstrace.dll` injected library, coverage and overhead scripts. |

Run on Linux: `./build.sh && node demo.mjs && node bench.mjs` (needs cargo, gcc, go, strace).
On macOS: `cargo build --release --target-dir target`, copy `target/release/libfstrace_addon.dylib`
to `fstrace.node`, build `bin/openloop` with clang and `bin/readfile-go` with go, then
`node demo-macos.mjs && node bench-macos.mjs`. Windows instructions are in its section below.

## Backends

- **preload**: env vars only, so it works with any spawn API, including
  `child_process.spawn`. Fast. Blind to anything that does not call libc dynamically:
  static binaries and Go programs (so esbuild, the Go-based tsc, etc.).
- **seccomp**: the child installs a BPF filter on itself before `exec` and sends us the
  listener fd. The kernel parks each read-capable `open*`/`exec*` until our supervisor
  thread has read the path from the child's memory. Needs no privileges, sees everything,
  but each event costs a round trip to the supervisor. Write-only and directory opens are
  dropped in the BPF program, in-kernel.
- **hybrid**: both. The shim issues its opens as raw `openat` syscalls with a marker in
  an unused argument register; the BPF program lets marked opens through without a
  notification. Dynamic binaries pay preload prices, and only what the shim cannot see
  (static/Go binaries, the dynamic loader's own opens, `fopen`) takes the slow path.

## Results (Linux x86_64, kernel 6.18, Firecracker microVM, median of 5)

Coverage (`node demo.mjs`):

| Reader | preload | seccomp | hybrid |
| --- | --- | --- | --- |
| dynamically linked C | yes | yes | yes |
| statically linked C | **no** | yes | yes |
| Go binary | **no** | yes | yes |
| Node sync + async fs | yes | yes | yes |
| shell / cat / grandchildren / python | yes | yes | yes |
| write-only open reported | no | no | no |

Overhead (`node bench.mjs`), wall clock relative to untraced:

| Workload | untraced | preload | seccomp | hybrid | strace |
| --- | --- | --- | --- | --- | --- |
| 200k `open`+`close` loop (worst case) | 177 ms | +73% | +3300% | +85% | +13000% |
| `grep -r` over `packages/nx/src` (1.6k files) | 17 ms | +49% | +445% | +66% | +4560% |
| Node `readFileSync` of the same tree | 83 ms | ~0% | +75% | +2% | +600% |
| 500 short-lived processes | 595 ms | +22% | +18% | +57% | +206% |
| `go build -a` (static toolchain, 2.7k events) | 4028 ms | n/a (sees nothing) | +9% | +7% | +76% |

Per-event cost in this VM: shim ≈ 0.6 µs per open; seccomp ≈ 30 µs per notified open;
loading the shim ≈ 0.25 ms per process. Numbers are from a shared VM and noisy at the
±10% level (the `go build` preload run measured +10% while tracing nothing). Context
switches are expensive in microVMs, so the seccomp figure is probably pessimistic for
bare metal; that is unmeasured.

## Known gaps and risks

Linux
- seccomp requires `no_new_privs`, so setuid binaries (`sudo`) inside the task stop
  elevating. The kernel allows one notification listener per filter chain, so a tool
  inside the task that wants its own (some container runtimes) gets `EBUSY`. Untested.
- The filter is installed between `fork` and `exec`, so the spawn must happen in native
  code (or via a tiny launcher binary); plain `child_process.spawn` cannot do it.
- The supervisor thread must outlive the direct child while any descendant is alive,
  otherwise their opens fail with `ENOSYS`. The spike detaches it; real code needs a
  deliberate lifetime story for daemonised children.
- seccomp reports *attempted* opens (it cannot see the result), the shim reports only
  successful ones. Failed lookups matter for cache correctness, so pick one on purpose.
- Not covered: `io_uring` opens (the filter makes `io_uring_setup` return `ENOSYS` so
  callers fall back), 32-bit/x32 syscalls on x86_64, `name_to_handle_at`, files that
  arrive as inherited fds or over sockets, and reads through an fd opened before tracing.
- Shim only: misses the dynamic loader's library loads, `opendir`, and env-scrubbing
  children (`env -i`) drop `LD_PRELOAD`. Hybrid covers all three.
- The shim keeps a log fd at ≥1000; a child that closes all fds and reuses that number
  would receive our log lines. Needs an fstat guard or a different channel.
- `stat`/`access`/`readlink`/`readdir` are deliberately not tracked (reads only).

macOS (run on an M-series Mac, macOS 26, Node 22.15; `demo-macos.mjs`, `bench-macos.mjs`)
- The Rust shim works as written. The arm64 variadic `open` trick holds, and Go binaries
  are seen even with `CGO_ENABLED=0`, because Go on darwin calls through libSystem.
- Official Node binaries carry `allow-dyld-environment-variables` and
  `disable-library-validation`, so node, and node spawning node directly, are fully traced.
- SIP is transitive. A tree loses tracing at the first platform binary (`/bin/sh`,
  `/bin/cat`, `/usr/bin/python3`) *and for everything below it*, so
  `execSync('node ...')` hides the grandchild node because it runs through `/bin/sh`.
- A copy of a platform binary, ad-hoc re-signed (`codesign -s - -f`), accepts injection and
  keeps the variable for its children. So an `execve`/`posix_spawn` hook that swaps SIP
  paths for cached re-signed copies would close the gap. Two catches: the copies are
  `arm64e`, so the shim needs an `arm64e` slice (C, or nightly Rust), and an unsigned copy
  is SIGKILLed at launch. A C interposer built `-arch arm64 -arch arm64e` proved the idea.
- Overhead: about 1.9 µs per traced open, about 2 ms to load the shim per process.

  | Workload | untraced | preload |
  | --- | --- | --- |
  | 200k `open`+`close` | 1413 ms | +27% |
  | Node `readFileSync` of `packages/nx/src` | 60 ms | +14% |
  | Node startup | 21.5 ms | +9% |

Windows (`windows/`, run in a Windows 11 ARM64 VM, Node 22.16 arm64)
- Written in C with no dependencies. `fstrace.exe` starts the command suspended in a job
  object and loads `fstrace.dll` through an early APC (`LoadLibraryW`). The DLL rebinds
  import-table entries for `ntdll!NtCreateFile`/`NtOpenFile`, `LdrLoadDll` (to patch DLLs
  loaded later) and `CreateProcessW` (to inject into children). Every Win32 open ends in
  kernelbase's import of `NtCreateFile`, so one patched table covers the CRT, libuv and Go.
- Coverage (`node demo-windows.mjs`). There is no SIP equivalent, so shells are not a gap.

  | Reader | traced |
  | --- | --- |
  | C, static CRT (arm64) | yes |
  | Go binary | yes |
  | Node sync + async fs | yes |
  | node -> node (no shell) | yes |
  | node -> `cmd.exe` -> node (`execSync`) | yes |
  | `cmd /c type`, `cmd -> cmd -> type` | yes |
  | PowerShell `Get-Content` | yes |
  | x64 program under emulation, direct or as a child | **no** |
  | Git for Windows (x64 build on this VM) | **no** |
  | write-only open reported | no |

- Missed: x64 processes under emulation on ARM64 (including Git for Windows here), because
  the tracer only injects same-architecture children. On x64 Windows the same gap applies to
  32-bit children. Fixing it needs a DLL per architecture and the target's own
  `LoadLibraryW` address.
- Not covered: the loader's own DLL opens (ntdll calls itself, not through an import table)
  and code that calls `NtCreateFile` from inside ntdll. Inline hooks would close both.
- Overhead: about 4.8 µs per traced open. Node startup costs about 20 ms extra, which is
  unexplained so far (candidates are patching every loaded module and Defender scanning
  the DLL).

  | Workload | untraced | traced |
  | --- | --- | --- |
  | 200k `CreateFile`+`CloseHandle` | 2445 ms | +39% |
  | Node `readFileSync` of `packages/nx/src` | 775 ms | ~0% |
  | Node startup | 62 ms | +32% |
  | 50 short processes via `cmd` loop | 360 ms | +15% |

  Build in a VS developer prompt with `windows\build.cmd`, then `node demo-windows.mjs` and
  `node bench-windows.mjs` (the bench expects `readall.js` and a copy of `packages/nx/src`
  under `windows\src`).

## macOS: tracing past SIP

`shim-macos/fstrace.c` is a C port of the shim that also hooks `execve`, `posix_spawn` and
`posix_spawnp`. When a traced process starts a binary dyld would strip
`DYLD_INSERT_LIBRARIES` for, the hook starts an ad-hoc re-signed copy instead, and the copy
keeps the variable. C, because the copies are `arm64e` and stable Rust cannot build that
slice; the dylib is built `arm64`, `arm64e` and `x86_64`.

- **Detection reads the code signature**, not the path: a platform binary, `CS_RESTRICT`,
  or the hardened runtime without `allow-dyld-environment-variables`. Setuid and setgid
  binaries count too. Verdicts match `codesign` for `/bin/*`, `/usr/bin/*`, mise, node,
  dotnet, Temurin java and cargo (`target/check-restricted`).
- **Shebang scripts** are handled in the hook. The kernel would start the interpreter
  itself, so the hook reads `#!`, swaps the interpreter for its copy and passes the script.
  That covers `gradlew`, `mvn` and `#!/usr/bin/env node`.
- **Copies live in an nx-owned directory**, `/tmp/.nx/<uid>/sip-copies/<kernel release>`,
  established by `sip/sip-copy-dir.ts` through the same guards as the native file cache
  (`ensureSafeSharedRoot`, then `ensureOwnedPrivateDir` for each level). The shim
  re-checks it is a real directory owned by the user with no group or other bits, and
  ignores it otherwise. Each copy sits in a directory keyed by inode, mtime and size, and
  keeps its original file name, because multi-call shims dispatch on it: xcrun's
  `/usr/bin/python3` failed when the copy was named `python3-<key>`.
- **Anything not traced is reported.** A binary that cannot be copied, or is setuid
  (`sudo`, whose copy would lose its privileges), runs as the original and logs
  `!untraced <path>`, so a consumer can treat that run's read list as incomplete.
- **Scrubbed environments are repaired.** A child spawned with `env: {}` gets
  `DYLD_INSERT_LIBRARIES`, `FSTRACE_OUT` and `FSTRACE_SIP_DIR` back.

Coverage (`tsx demo-sip.ts`, every case started from node, as a plugin worker would):

| Case | without rewrite | with rewrite |
| --- | --- | --- |
| node -> `/bin/sh` -> cat | missed | seen |
| node -> `/bin/sh` -> sh -> cat | missed | seen |
| node -> `execSync` node (via `/bin/sh`) | missed | seen |
| node -> `/bin/cat` | missed | seen |
| node -> `#!/bin/sh` script (gradlew) | missed | seen |
| node -> `#!/usr/bin/env node` script | missed | seen |
| node -> node with `env: {}` | seen | seen |
| node -> mise shim -> dotnet | missed | seen |
| node -> `/usr/bin/python3` (xcrun shim) | missed | seen |
| node -> sh -> `sudo` | missed | missed, reported untraced |

Cost (`tsx bench-sip.ts`, node running `/bin/sh -c true` 200 times):

| Run | per exec |
| --- | --- |
| untraced | 2.9 ms |
| traced, no rewrite (the shells are not traced) | 3.1 ms |
| traced, rewrite, copies already made | 8.5 ms |
| first run, empty copy directory | 10.4 ms (2 s total, one-time `codesign` per binary) |

The extra 5.4 ms is mostly loading the shim, about 2 to 3 ms per process, now paid by the
shells as well, and macOS's `/bin/sh` starts `/bin/bash`, so each shell exec is two
injected processes. A copy on its own costs about 0.7 ms more to start than the original,
because it is not in the dyld shared cache.

Not done here:
- The root of the traced tree is started by the addon in Rust, without the hook, so a
  restricted binary started directly by `traceSpawn` is not rewritten. Plugin workers are
  node, so this does not matter for them, but the launcher should apply the same rewrite.
- Swap `/bin/sh` straight for a copy of the shell `/private/var/select/sh` names, run as
  `sh`, to save one exec per shell.
- Find what makes the shim cost 2 to 3 ms to load (signature validation of the inserted
  dylib is the first suspect).
- A binary that needs private entitlements breaks as a copy instead of going untraced.
  None of the cases here did, but the hook cannot tell in advance.

## What real plugins spawn

Node-only plugin workers are traced on every platform. The plugins whose inputs are hardest to
declare are the ones that delegate to another toolchain, and those hit the gaps:

| Plugin | Spawns | macOS | Daemon |
| --- | --- | --- | --- |
| `@nx/gradle` | `./gradlew` (`#!/bin/sh`), then java | lost at `/bin/sh` without the rewrite | Gradle daemon, on by default |
| `@nx/maven` | `mvnd`, else `mvnw`/`mvn` (`#!/bin/sh`), then java | lost at `/bin/sh` without the rewrite | `mvnd` when present |
| `@nx/dotnet` | `dotnet` (MSBuild in-process) | fine, unless reached through a version-manager shim | none |
| community rust | `cargo metadata` | fine (ad-hoc signed) | none |

- The real toolchain binaries accept injection: Temurin `java` and `dotnet` carry
  `allow-dyld-environment-variables`, and `cargo` is ad-hoc signed. Their launchers are
  the problem. Shell-script wrappers run through `/bin/sh`, and mise's shim binary uses
  the hardened runtime without that entitlement, so it strips the variable too.
- Daemons defeat process-tree tracing on every platform. Later runs talk to the daemon
  over a socket, so its reads happen outside the traced tree. Forcing `--no-daemon`
  during graph construction would cost a JVM start and a Gradle configuration phase
  per run.
- `@nx/dotnet` already reports its own inputs. Its analyzer returns every workspace file
  MSBuild read as `evaluationInputs`, and `analyzer-client.ts` hashes that list to decide
  whether a cached result is still valid. For delegating plugins, a tool-reported list
  like this beats tracing.

## Suggested next steps

1. Decide whether failed opens and `stat` calls count as inputs.
2. Cut the macOS shim's per-process load cost, and the double exec through `/bin/sh`.
3. Inject across architectures on Windows (a DLL per architecture).
4. Find the 20 ms Node startup cost on Windows.
5. Replace the append-per-event log file with a shared-memory ring and trim the shim
   (`no_std`) to cut the per-process load cost.
