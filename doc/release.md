# Release

Releases are automated with [semantic-release](https://semantic-release.gitbook.io/semantic-release/) on every push to `main`. Conventional Commits determine the next version, generate release notes and `CHANGELOG.md`, publish the package to npm, and create a GitHub Release.

## Process

1. Changes land on `main` through PRs using Conventional Commits.
2. The release workflow runs a `verify` job: checkout, Bun canary, OpenCode 2.4.2, install, typecheck, lint, format check, unit tests, build via integration tests, and artifact upload.
3. The `release` job checks out with write access, installs dependencies, downloads `dist/`, and runs `npx semantic-release`.
4. semantic-release:
   - analyses commits since the last release;
   - determines the next `MAJOR`/`MINOR`/`PATCH` version;
   - updates `CHANGELOG.md` and `package.json`;
   - publishes `dist/` to npm;
   - creates the GitHub Release with generated notes;
   - commits the version bump and changelog with `[skip ci]`.

Commit messages drive versioning: `fix:` → `PATCH`, `feat:` → `MINOR`, `BREAKING CHANGE:` or `!` → `MAJOR`. Docs/test/chore commits do not trigger a release.

## Configuration

- `.releaserc.json`: branch `main` and plugin chain (`commit-analyzer`, `release-notes-generator`, `changelog`, `npm`, `git`, `github`).
- `package.json`: `files: ["dist"]`, `license`, `repository`, and `publishConfig.access: public`.
- `.github/workflows/release.yml`: verify and release jobs described above.

## Repository secrets

Set these in GitHub repository settings:

| Secret         | Purpose                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| `NPM_TOKEN`    | npm automation token with publish rights to `opencode-peer-mcp`. Used as `NPM_TOKEN` and `NODE_AUTH_TOKEN`. |
| `GITHUB_TOKEN` | Provided automatically; used to push the release commit and create the GitHub Release.                      |

No manual tagging is required. Do not hand-edit `CHANGELOG.md` version sections or `package.json` version for a release; semantic-release owns both.
