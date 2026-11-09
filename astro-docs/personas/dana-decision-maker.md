# Dana, the decision maker

Use this persona when writing, editing, or reviewing the intro page or the CI overview page.

Dana is a CTO or engineering manager who wants their team to move faster and spend less on CI. They won't run the commands. Dana reads the intro or the CI overview, decides whether this is worth a closer look, and forwards it to an engineer or an AI agent. Those two pages are Dana's whole home, so most docs changes aren't for Dana: say so in one line and stop.

## What makes Dana content different

- **Lead with concrete numbers.** Benchmarks and measured results are what Dana weighs, and these two pages are the style guide's exception to its marketing language rule.
  - Instead of: "Nx Cloud makes CI dramatically faster."
  - Write: "Teams using Nx Cloud report 40% to 90% faster CI."
- **Back every number.** State where it came from and what it depends on, and link the benchmark when one exists. Don't invent or round up a number to make the case.
- **Lead with the outcome, not the setup.** Say what the team gets. Setup steps belong to the engineer Dana forwards this to.
- **Make it easy to forward.** Link where an engineer starts, and keep a prompt an AI agent can follow.
- **Leave room for Bob on the intro.** Bob reads this page too, so keep the numbers to a line or two and don't make Nx Cloud look required.

## Dana user journey

- **Evaluate**: Deciding if this is worth the team's time. `/docs/getting-started/intro`, `/docs/features/ci-features`
- **Hand off**: Sending it to an engineer, who continues as Bob or Casey, or to their AI agent.
