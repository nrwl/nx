# Playwright

After making changes to a project, run the relevant test file to verify your changes work correctly.

## Mode Detection

Check in order (first match wins):

| Mode      | Detection                                                    |
| --------- | ------------------------------------------------------------ |
| Inference | `@nx/playwright/plugin` in nx.json plugins array             |
| Executor  | `@nx/playwright:playwright` executor in project.json targets |

## Run Specific Test File

### Inference

```bash
nx e2e <project> -- <path/to/file.spec.ts>
```

### Executor

```bash
nx run <project>:e2e --testFiles=<path/to/file.spec.ts>
```

## Quick Reference

| Task        | Inference                          | Executor                                        |
| ----------- | ---------------------------------- | ----------------------------------------------- |
| Run file    | `nx e2e proj -- path/file.spec.ts` | `nx run proj:e2e --testFiles=path/file.spec.ts` |
| Run pattern | `nx e2e proj -- --grep="pattern"`  | `nx run proj:e2e --grep="pattern"`              |
