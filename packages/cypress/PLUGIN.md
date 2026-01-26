# Cypress

After making changes to a project, run the relevant test file to verify your changes work correctly.

## Mode Detection

Check in order (first match wins):

| Mode      | Detection                                              |
| --------- | ------------------------------------------------------ |
| Atomized  | `ciTargetName` in nx.json `@nx/cypress` plugin options |
| Inference | `@nx/cypress/plugin` in nx.json plugins array          |
| Executor  | `@nx/cypress:cypress` executor in project.json targets |

## Run Specific Test File

### Atomized

```bash
nx run <project>:<ciTargetName>--<path/to/file.cy.ts>
# Example: nx run my-app-e2e:e2e-ci--src/login.cy.ts
```

### Inference

```bash
nx e2e <project> -- --spec=<path/to/file.cy.ts>
```

### Executor

```bash
nx run <project>:e2e --spec=<path/to/file.cy.ts>
```

## Quick Reference

| Task        | Atomized                              | Inference                               | Executor                                 |
| ----------- | ------------------------------------- | --------------------------------------- | ---------------------------------------- |
| Run file    | `nx run proj:e2e-ci--path/file.cy.ts` | `nx e2e proj -- --spec=path/file.cy.ts` | `nx run proj:e2e --spec=path/file.cy.ts` |
| Run pattern | N/A                                   | `nx e2e proj -- --spec="**/*login*"`    | `nx run proj:e2e --spec="**/*login*"`    |
