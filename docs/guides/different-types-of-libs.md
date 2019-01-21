# Different types of libraries

There are many different types of libraries in a workspace.
In order to maintain a certain sense of order, we recommend
having only the below four types of libraries:

- Feature libraries: Developers should consider feature libraries
  as libraries that implement smart UI (with injected services) for
  specific business use cases or pages in an application.
- UI libraries: A UI library contains only presentational components.
- Data-access libraries: A data-access library contains services and
  utilities for interacting with a back-end system.
- Utility libraries: A utility library contains common utilities and
  services used by many libraries and applications. It also includes
  all the code related to State management.
