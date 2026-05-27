{
  description = "Nx — Smart Monorepos · Fast Builds";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_20
            pnpm
            rustup
            jdk
            git
            pkg-config
          ];

          shellHook = ''
            echo "Nx development environment"
            echo ""
            echo "Prerequisites:"
            echo "  1. Run: pnpm install"
            echo "  2. Run: pnpm build"
            echo ""
            echo "For more info, see CONTRIBUTING.md"
          '';
        };

        apps.default = {
          type = "app";
          program = toString (pkgs.writeShellScript "nx-devshell-info" ''
            echo "This flake provides a development shell for Nx."
            echo "Run: nix develop github:levonk/nx"
          '');
        };
      }
    );
}
