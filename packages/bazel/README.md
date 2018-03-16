Bazel Commands

## Add new app

node_modules/.bin/ng generate app [name]

Example: node_modules/.bin/ng generate app test

## Add new component

node_modules/.bin/ng generate component [name] --directory=[dir]

Example: node_modules/.bin/ng generate component friends --directory=myDir

* must manually import the component's Bazel rule in the consuming Bazel rule

## Add new lib

node_modules/.bin/ng generate lib [name]

Example: node_modules/.bin/ng generate lib mylib

* must manually import the lib's Bazel rule in the consuming Bazel rule

## Run dev server

ibazel run apps/[app specific path]]/src:devserver (anything between apps/\*\*/src points to a specific app)

Example: ibazel run apps/my-dir/my-app/src:devserver

## Run prod server

bazel run apps/[app specific path]]/src:prodserver (anything between apps/\*\*/src points to a specific app)

Example: bazel run apps/my-dir/my-app/src:prodserver

## Run unit tests

ibazel test //libs/mylib/src:test

* currently works for libs
