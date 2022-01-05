# Creating Libraries

Like a lot of decisions in programming, deciding to make a new Nx library or not is all about trade-offs. Each organization will decide on their own conventions, but here are some trade-offs to bear in mind as you have the conversation.

## Should I Make a New Library?

There are three main benefits to breaking your code up into more libraries.

### 1. Faster Commands

The more granular your libraries are, the more effective `nx affected` and Nx's computation cache will be. For example, if `libraryA` contains 10 tests, but only 5 of them were affected by a particular code change, all 10 tests will be run by `nx affected --target=test`. If you can predict which 5 tests are usually run together, you can split all the related code into a separate library to allow the two groups of 5 tests to be executed independently.

### 2. Visualizing Architecture

The `nx dep-graph` command generates a graph of how apps and libraries depend on each other. If most of your code lives in a few giant libraries, this visualization doesn't provide much value. Adding the `--watch` flag to the command will update the visualization in-browser as you make changes.

### 3. Enforcing Constraints

You can enforce constraints on how different types of libraries depend on each other [using tags](/structure/monorepo-tags). Following pre-determined conventions on what kind of code can go in different types of libraries allows your tagging system to enforce good architectural patterns.

Also, each library defines its own API, which allows for encapsulating logic that other parts of codebase can not access. You can even use a [CODEOWNERS file](https://help.github.com/en/github/creating-cloning-and-archiving-repositories/about-code-owners) to assign ownership of a certain library to a user or team.

## Should I Add to an Existing Library?

Limiting the number of libraries by keeping code in an existing library also has benefits.

### 1. Consolidating Code

Related code should be close together. If a developer can accomplish a task without moving between multiple different folders, it helps them work faster and make less mistakes. Every new library adds some folders and configuration files that are not directly contributing to business value. Nx helps reduce the cost of adding a new library, but it isn't zero.

### 2. Removing Constraints

Especially for rapidly evolving code, the standard architectural constraints may just get in the way of experimentation and exploration. It may be worthwhile to develop for a while in a single library in order to allow a real architecture to emerge and then refactoring into multiple libraries once the pace of change has slowed down.
