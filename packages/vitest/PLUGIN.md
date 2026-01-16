# Vitest

After making changes to a project, run the relevant test file to verify your changes work correctly.

## Mode Detection

Check in order (first match wins):

| Mode      | Detection                                                           |
| --------- | ------------------------------------------------------------------- |
| Atomized  | `ciTargetName` in nx.json `@nx/vitest` or `@nx/vite` plugin options |
| Inference | `@nx/vitest` or `@nx/vite/plugin` in nx.json plugins array          |
| Executor  | `@nx/vitest:test` executor in project.json targets                  |

## Run Specific Test File

### Atomized

```bash
nx run <project>:<ciTargetName>--<path/to/file.spec.ts>
# Example: nx run my-lib:test-ci--src/utils.spec.ts
```

### Inference

```bash
nx test <project> -- <path/to/file.spec.ts>
```

### Executor

```bash
nx run <project>:test --testFile=<path/to/file.spec.ts>
```

## Quick Reference

| Task        | Atomized                                 | Inference                           | Executor                                        |
| ----------- | ---------------------------------------- | ----------------------------------- | ----------------------------------------------- |
| Run file    | `nx run proj:test-ci--path/file.spec.ts` | `nx test proj -- path/file.spec.ts` | `nx run proj:test --testFile=path/file.spec.ts` |
| Run pattern | N/A                                      | `nx test proj -- -t "pattern"`      | `nx run proj:test --testNamePattern="pattern"`  |
