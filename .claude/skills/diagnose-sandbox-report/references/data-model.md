# Sandbox Report Data Model

## Raw Report Structure (JSON)

```typescript
interface SandboxReport {
  taskId: string; // "project:target" or "project:target:configuration"
  sandboxReportId: string;
  inputs: string[]; // declared input patterns (globs or paths)
  outputs: string[]; // declared output patterns
  filesRead: FileAccessEntry[]; // all files actually read
  filesWritten: FileAccessEntry[]; // all files actually written
  unexpectedReads?: FileAccessEntry[]; // reads not matching any input pattern
  unexpectedWrites?: FileAccessEntry[]; // writes not matching any output pattern
  expectedInputsNotRead?: string[]; // declared inputs never accessed
  expectedOutputsNotWritten?: string[]; // declared outputs never written
  processTree?: ProcessTreeEntry[]; // process hierarchy with commands
}

interface FileAccessEntry {
  path: string; // workspace-relative file path
  pid: number; // process ID that accessed the file
}

interface ProcessTreeEntry {
  pid: number;
  cmd: string; // full command string
  parentPid?: number; // parent process (absent for root)
}
```

## Violation Computation

Violations are computed by `findUnexpectedFiles()` using `minimatch`:

- A file is "unexpected" if it does NOT match any declared pattern
- Patterns without wildcards also match as directory prefixes (`pattern + '/'`)
- If `unexpectedReads`/`unexpectedWrites` are pre-computed in the report, those are used directly

## Nx CLI Commands for Context

### `nx show target <project:target> --json`

Returns: executor, command, options (merged with configuration), inputs (configured, not resolved), outputs, dependsOn, cache, parallelism, configurations, metadata.

### `nx show target inputs <project:target> --json`

Returns resolved input files (requires files to exist on disk — task must have run):

```json
{
  "files": ["workspace-relative paths..."],
  "runtime": ["node version checks..."],
  "environment": ["ENV_VAR_NAMES..."],
  "depOutputs": ["dependency output paths..."],
  "external": ["external package names..."]
}
```

### `nx show target inputs <project:target> --check <files...>`

Validates specific files against declared inputs. Exit code 0 = match, 1 = no match.
Categories: `files`, `environment`, `runtime`, `external`, `depOutputs`.
Also detects directory matches (directory containing N input files).

### `nx show target outputs <project:target> --json`

Returns:

```json
{
  "outputPaths": ["configured output paths..."],
  "expandedOutputs": ["glob-expanded actual paths..."],
  "unresolvedOutputs": ["{options.key} patterns that couldn't resolve..."]
}
```

### `nx show target outputs <project:target> --check <files...>`

Validates specific files against declared outputs. Same exit code behavior as inputs.

### `nx show project <project> --json`

Returns full project config. Key fields for sandbox analysis:

- `targets[name].metadata.plugin` — which plugin inferred the target
- `targets[name].metadata.technologies` — what tech the target uses
- `root` — project root directory

### `nx graph --view=tasks --targets=<target> --focus=<project> --print --file=stdout`

Returns task dependency graph with task IDs, dependencies, and roots.
