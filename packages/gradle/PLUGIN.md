# Gradle

After making changes to a project, run the relevant test class to verify your changes work correctly.

## Run Specific Test Class

Use the `test` target with the `--testClassName` flag to filter by class name:

```bash
nx test <project> --testClassName=<ClassName>
# Example: nx test my-app --testClassName=DemoApplicationTest
```

**Important**: Do NOT use the atomized `nx run <project>:<ciTestTargetName>--<ClassName>` targets directly. Always use the `test` target with `--testClassName` instead.

## Quick Reference

| Task           | Command                                            |
| -------------- | -------------------------------------------------- |
| Run test class | `nx test proj --testClassName=DemoApplicationTest` |
| Run all tests  | `nx test proj`                                     |
