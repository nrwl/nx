## Why is a workspace (or mono repo) needed?

Working with and maintaining multiple applications and libraries is not an easy task. From Google to Facebook, Uber, Twitter and more, a good amount of large software companies handle this challenge by taking a mono repo approach. And they have been doing so for years. It is an approach that is tested and proven to help companies be successful growing large code bases at scale, both with the code and with the teams that write and maintain it.
But, what is it about multiple applications/libs that presents the need for a single workspace or mono repo? Let's take, for example, an application domain for a support ticket system which would
would consist of:
- Customer application for submitting tickets (Angular app)
- Admin application for working tickets (Angular app)
- Library of shared code for the above (Angular lib)
- Web service for the data (Node)
- Content delivery network (CDN) for assets (Static server)

Now we could have an individual project in an individual repo for each of those, but
we would quickly be confronted with the following challenges:
- We need a strategy for keeping dependencies consistent across each project and updating local dependencies across projects
- When we commit a code change to one project that another one depends upon we need to create a separate
commit to the implementor(s)
- When a developer goes to work on Application A they need to be aware of 
which version the other applications are designed to work with
- ...and they need to have those in their local environment
- ...and many others (multiple instances of node_modules, complex scripts to launch all apps, etc)...

A workspace (mono repo) for the application domain can help alleviate a lot of those
challenges and it can help facilitate positive programming and architecture practices.

Here's an example. Say we have some code to format support ticket metadata that we use
in the customer app and the admin app. Making a shared lib folder to house that code in
our workspace is trivial. We can move the code there and `import` reference it within
our apps. No need to `npm install` the library for each app. And when we decide to extract
out some common string formatting code that is within that library...again, a trivial new lib
folder creation and code move and we are on our way.

Because that library creation and refactoring is trivial, we are not hesitant to take it
on. So we can find ourselves more apt to modularize our code as we architect it because
the barrier to entry is minimal. And the more we modularize the more we can take advantage
of things like lazy loading and tree shaking and more. Things that are important in
the web space.

## Advantages
Below are some more specific advantages to going with a mono repo workspace.

- Unified versioning
    - Everything at that current commit works together
    - A label or branch can capture the same
- Promotes code sharing and reuse
    - Easy to split code into lib modules
    - Easy to consume/implement that code and the latest changes to it
- Easier dependency management
    - One node_modules for all code
    - One build setup (like the AngularCLI)
- Refactoring benefits
    - Code editors and IDEs are "workspace" aware
    - Can have a single commit for a refactor that spans applications in the domain
- Consistent developer experience
    - Ensures all necessary dependant code is available

## Disadvantages
Now look, we are talking real world application development here. And as we know, there 
are no 100% perfect fits when it comes to development. We have to weight the pluses and minuses
and make decisions accordingly. So, here are some of the potential disadvantages that
we want to be aware of when it comes to a mono repo workspace.

- Takes work to try and limit access to parts of the code base
- An upgrade to a lib requires a change to all implementors (can't roll out different versions side by side)
- Can lead to accepted dependencies, making it overkill to work on a small feature
    - Say some library code is designed to hit the web service, in a single workspace
      you know the service is available so effort might not be made to be able to run
      that library code with a mock service
