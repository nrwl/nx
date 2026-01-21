I want to make some changes to configure-ai-agents. It should now distribute more things for each AI agent:

- for claude, a claude plugin
- for opencode and github copilot - new commands, skills and subagents
- for cursor, codex cli, gemini cli - new commands and skills
  (opencode has to be a new agent in the list of agents that are available)

It should clone the skills, commands and subagent definitions from the https://github.com/nrwl/nx-ai-agents-config repo to a local repo and copy from there. There are some utils in this repo already for cloning repos (I think for the new create-nx-workspace template repo flow). Reuse those as much as possible. Make sure that we don't have to re-clone on EVERY invocation but that things are cached if possible.

You can look at markdown files in here /Users/maxkless/Projects/coworkspace/coding-agent-investigation/extensibility for each agent - they will tell you more details about how to configure each of the agents I listed.
