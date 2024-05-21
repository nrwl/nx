FROM mcr.microsoft.com/devcontainers/typescript-node:20-bullseye

# Update the underlying (Debian) OS, to make sure we have the latest security patches and libraries like 'GLIBC' 
RUN sudo apt-get update  && sudo apt-get -y upgrade

# Update pnpm
RUN npm install -g pnpm@8.15.7
