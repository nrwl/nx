# Recording Non-Nx Commands
Build and deploy pipelines often do much more than run builds. Unfortunately, this creates more opportunities for pieces to fail. To minimize the number of different sites you need to visit to diagnose issues, Nx Cloud 13.3 and above is capable of recording and saving output from arbitrary commands.

## Enable Command Recording 
To record a command with Nx Cloud:

1. Identify a command you would like recorded from your CI/CD configuration, or think of one to run on your personal machine. (example: echo "hello world")
2. Prefix your command with npx nx-cloud record -- , or the appropriate execute command of your package manager. The -- is optional, but makes it easier to read what portion of the command will be recorded. (example: npx nx-cloud record -- echo "hello world")
3. Run the command! Nx Cloud will record output and status codes, and generate a link for you to view your output on so you can easily view or share the result. Make sure you run this command from your workspace root or one of its subdirectories so Nx Cloud can properly locate configuration information.

![npx nx-cloud record -- echo "hello world"](/nx-cloud/set-up/record-hello-world.png)

## Locating Command Output in Nx Cloud 
Commands that Nx Cloud stores will appear under your "Runs" view. For easy identification, stored output will be displayed as a "record-output" target being invoked on the "nx-cloud-tasks-runner" project.

![nx-cloud record -- yarn nx workspace-lint](/nx-cloud/set-up/record-workspace-lint.png)

If you use the Nx Cloud Github Integration, links to recorded output will also be displayed based on exit code in the summary comment.

![Nx Cloud Report](/nx-cloud/set-up/record-report.png)
