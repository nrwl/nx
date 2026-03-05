# Gradle

After making changes to a project, run the relevant test class(es) to verify your changes work correctly.

## Run Specific Test Class

Use the `test` target with the `--testClassName` flag to filter by class name:

```bash
nx test <project> --testClassName=<ClassName>
# Example: nx test my-app --testClassName=DemoApplicationTest
```

## Quick Reference

| Task           | Command                                            |
| -------------- | -------------------------------------------------- |
| Run test class | `nx test proj --testClassName=DemoApplicationTest` |
| Run all tests  | `nx test proj`                                     |
