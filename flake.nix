{
  description = "Holy Shelf — flavor lists for holy.com";

  inputs = {
    nixpkgs.url = "https://flakehub.com/f/JHOFER-Cloud/NixOS-nixpkgs/0.1.tar.gz";
  };

  nixConfig = {
    extra-trusted-public-keys = "ojsef39.cachix.org-1:Pe8zOhPVMt4fa/2HYlquHkTnGX3EH7lC9xMyCA2zM3Y=";
    extra-substituters = "https://ojsef39.cachix.org";
  };

  outputs = {
    self,
    nixpkgs,
    ...
  }: let
    systems = nixpkgs.lib.systems.flakeExposed;
    forEachSystem = nixpkgs.lib.genAttrs systems;
  in {
    devShells = forEachSystem (
      system: let
        pkgs = nixpkgs.legacyPackages.${system};

        # web-ext and semantic-release are pinned in package.json, so the shell
        # ships node and each script installs from the lockfile on demand.
        # Firefox is deliberately absent: nixpkgs has no darwin build of it, and
        # web-ext finds the system install on both platforms anyway.
        preamble = ''
          set -euo pipefail
          cd "$(${pkgs.git}/bin/git rev-parse --show-toplevel)"
          if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
            echo "=> Installing npm dependencies..."
            ${pkgs.nodejs_22}/bin/npm ci
          fi
        '';

        # Temporary add-on in a scratch profile, opened on the account page.
        # Extra args pass through to web-ext, e.g. d-start --devtools.
        d-start = pkgs.writeShellScriptBin "d-start" ''
          ${preamble}
          echo "=> Launching Firefox with Holy Shelf loaded..."
          ${pkgs.nodejs_22}/bin/npm start -- "$@"
        '';

        d-lint = pkgs.writeShellScriptBin "d-lint" ''
          ${preamble}
          echo "=> Running alejandra..."
          ${pkgs.alejandra}/bin/alejandra .
          echo "=> Running web-ext lint..."
          ${pkgs.nodejs_22}/bin/npm run lint
        '';

        d-build = pkgs.writeShellScriptBin "d-build" ''
          ${preamble}
          echo "=> Packaging into web-ext-artifacts/..."
          ${pkgs.nodejs_22}/bin/npm run build
        '';
      in {
        default = pkgs.mkShell {
          packages = [
            d-start
            d-lint
            d-build

            pkgs.nodejs_22
            pkgs.alejandra
          ];
        };
      }
    );

    formatter = forEachSystem (system: nixpkgs.legacyPackages.${system}.alejandra);
  };
}
