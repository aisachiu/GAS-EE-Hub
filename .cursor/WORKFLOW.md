# Fork branch workflow

This file lives only on `dev`. Do not copy it, or anything else under `.cursor/`, onto `main` or into an upstream pull request.

## Branches

- `main` mirrors [upstream](https://github.com/vsahkg/GAS-EE-Hub) `main`. It has no `.cursor/` directory.
- `dev` is `main` plus this fork's `.cursor/` Cursor cloud environment.
- `main-backup` is a snapshot of this fork's `main` from before it was reset to upstream. It is a safety net, not a working branch.

## Making a change

1. Start the feature branch from `main`.
2. Merge that feature branch into `dev` when you want to run it with Cursor. `dev` supplies `.cursor/`.
3. Open the upstream pull request from the feature branch. The branch must contain no `.cursor/` paths.
