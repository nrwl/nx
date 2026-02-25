# Vitest

After making changes to a project, run the relevant test file to verify your changes work correctly.

## Mode Detection

Check in order (first match wins):

| Mode      | Detection                                                  |
| --------- | ---------------------------------------------------------- |
| Inference | `@nx/vitest` or `@nx/vite/plugin` in nx.json plugins array |
| Executor  | `@nx/vitest:test` executor in project.json targets         |

## Run Specific Test File

### Inference

```bash
nx test <project> -- <path/to/file.spec.ts>
```

### Executor

```bash
nx run <project>:test --testFile=<path/to/file.spec.ts>
```

## Quick Reference

| Task        | Inference                           | Executor                                        |
| ----------- | ----------------------------------- | ----------------------------------------------- |
| Run file    | `nx test proj -- path/file.spec.ts` | `nx run proj:test --testFile=path/file.spec.ts` |
| Run pattern | `nx test proj -- -t "pattern"`      | `nx run proj:test --testNamePattern="pattern"`  |
