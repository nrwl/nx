#!/bin/bash

# Update the underlying (Debian) OS, to make sure we have the latest security patches and libraries like 'GLIBC'
echo "⚙️ Updating the underlying OS..."
sudo apt-get update && sudo apt-get -y upgrade

# Install mise for managing development tools (Node, Java, Rust, Dotnet)
echo "⚙️ Installing mise..."
curl https://mise.run | sh

# Add mise to PATH
export PATH="$HOME/.local/bin:$PATH"

# Trust the mise.toml configuration file
echo "⚙️ Trusting mise.toml configuration..."
mise trust

# Install all tools from mise.toml (node, java, rust, dotnet)
echo "⚙️ Installing tools via mise (node, java, rust, dotnet)..."
mise install

# Activate mise to make tools available in current shell
eval "$(mise activate bash)"

# Add mise activation to bashrc for future shell sessions
echo "⚙️ Configuring mise activation in shell..."
echo 'eval "$(~/.local/bin/mise activate bash)"' >> ~/.bashrc

# Prevent corepack from prompting user before downloading PNPM 
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# Enable corepack 
corepack enable 

# Install the PNPM version defined in the root package.json
echo "⚙️ Installing required PNPM version..."
corepack prepare --activate

# Install NPM dependencies
echo "⚙️ Installing NPM dependencies..."
pnpm install --frozen-lockfile
