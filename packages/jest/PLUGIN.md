# Jest

After making changes to a project, run the relevant test file to verify your changes work correctly.

## Mode Detection

Check in order (first match wins):

| Mode      | Detection                                        |
| --------- | ------------------------------------------------ |
| Inference | `@nx/jest/plugin` in nx.json plugins array       |
| Executor  | `@nx/jest:jest` executor in project.json targets |

## Run Specific Test File

### Inference

```bash
nx test <project> -- --testPathPattern=<path/to/file.spec.ts>
```

### Executor

```bash
nx run <project>:test --testFile=<path/to/file.spec.ts>
```

## Quick Reference

| Task        | Inference                                             | Executor                                        |
| ----------- | ----------------------------------------------------- | ----------------------------------------------- |
| Run file    | `nx test proj -- --testPathPattern=path/file.spec.ts` | `nx run proj:test --testFile=path/file.spec.ts` |
| Run pattern | `nx test proj -- -t "pattern"`                        | `nx run proj:test --testNamePattern="pattern"`  |
