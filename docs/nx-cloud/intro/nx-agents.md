# Nx Agents: The Next Leap in Distributed Task Execution

Nx Agents represent the next evolution of [Nx Cloud's Distributed Task Execution (DTE)](/ci/features/distribute-task-execution), bringing a new level of efficiency and simplicity to your CI/CD pipelines. Features include dynamic scaling, flaky task re-running, and intelligent task splitting and distribution. Keep reading to learn more.

{% youtube
src="https://youtu.be/KPCMg_Dn0Eo?si=TK-Ky8270ZGNmMUc"
title="Nx Agents in action splitting e2e tests at a file level"
 /%}

Currently in private beta, Nx Agents are slated for public release in Q1 2024. Don't miss the opportunity to be among the first to experience this groundbreaking tool. Sign up now for early access.

{% call-to-action title="Sign Up for Early Access" icon="nxcloud" description="Experience Nx Agents for yourself" url="https://cloud.nx.app/workflows-early-access" /%}

## Seamless Integration

Enabling task distribution with Nx Agents can be done in a single line. Simply add the following to your CI pipeline configuration:

```yaml
- name: Start CI run
  run: 'npx nx-cloud start-ci-run --distributes-on="8 linux-medium"'
  ...
```

Continue with your standard CI steps thereafter.

```yaml
  ...
- run: yarn install --frozen-lockfile
- name: Run verification
  run: 'npx nx affected -t build test lint && npx nx affected -t e2e-ci --parallel 1'
```

`linux-medium` is the name of the launch template that will be used to provision the agent. The default launch templates [can be found here](https://github.com/nrwl/nx-cloud-workflows/blob/main/launch-templates/linux.yaml). You can can also define your own template as can be [seen in the Nx codebase](https://github.com/nrwl/nx/blob/master/.nx/workflows/agents.yaml).

## Intelligent Dynamic Scaling

While [Nx Cloud's DTE](/ci/features/distribute-task-execution) requires static configuration of agents, often necessitating adjustments as your workspace evolves, Nx Agents introduce a dynamic scaling feature. This innovative approach automatically scales your CI resources, spinning up or tearing down agents in response to the specific demands of your pull requests (PRs).

## Revolutionizing Task Splitting

Consider an e2e project utilizing Cypress or Playwright. To leverage [affected](/ci/features/affected), [caching](/ci/features/remote-cache) and [distribution](/ci/features/distribute-task-execution), traditionally, you would need to break down your project into smaller, more manageable units. However, this can lead to a tedious and less efficient developer experience.

Nx Agents, in conjunction with a forthcoming Nx feature, solve this challenge by being able to dividing tasks (like e2e) into smaller, more refined units (e.g., at the file/test level). This enhances distribution across dynamically provisioned Nx Agents and can drastically reduce CI time.

## Flaky Task Re-Running: Enhancing Reliability

Flaky tasks can be a persistent challenge in software development. With Nx Agents, we’ve developed a reliable method to detect and automatically re-run such tasks. Utilizing cache hash keys to identify tasks and leveraging data from previous runs on Nx Cloud, Nx Agents can re-run flaky tasks on different agents, up to a predetermined maximum number of retries. This process is entirely transparent to the user, ensuring a smooth and reliable CI/CD experience.

---

Sign up now for early access and be one of the first to try Nx Agents.

{% call-to-action title="Sign Up for Early Access" icon="nxcloud" description="Experience Nx Cloud Agents for yourself" url="https://cloud.nx.app/workflows-early-access" /%}
