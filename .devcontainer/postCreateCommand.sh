#!/bin/sh

# Update the underlying (Debian) OS, to make sure we have the latest security patches and libraries like 'GLIBC' 
sudo apt-get update  && sudo apt-get -y upgrade

# Update pnpm
#npm install -g pnpm

# Install dependencies
pnpm install --frozen-lockfile

