# Releasing

Releases are tag-driven. A pushed `v*` tag runs the release workflow, which validates the tag, runs the full check suite, builds the project, and creates a GitHub Release from the curated changelog section.

## Release steps

1. Confirm all intended changes are merged to `main`.
2. Update `CHANGELOG.md`: move items from `Unreleased` into a new version section with the release date (ISO 8601).
3. Bump `version` in `package.json` to the release version.
4. Open a PR with the changelog and version changes, then merge it.
5. After the merge, push an annotated tag:

   ```bash
   git tag -a v0.2.0 -m "v0.2.0"
   git push origin v0.2.0
   ```

6. The workflow verifies the tag format, package version match, annotated tag, and that the tagged commit is reachable from `main`. It then runs `typecheck`, `lint`, `format:check`, unit tests, build (via integration tests), and integration tests.
7. The release job uploads `dist/` assets and uses the matching `CHANGELOG.md` section as the release body.

## Tag rules

- Tag names must be `vMAJOR.MINOR.PATCH` with an optional pre-release suffix such as `v0.2.0-alpha.1`.
- The tag suffix must match `package.json` exactly.
- Tags must be annotated and point at a commit on `main`.
- Do not retag or modify a published version. Fix issues in a new version.

## What is not automated

- npm publishing is not configured.
- The changelog is not generated; it is curated before tagging.
- Announcements are manual.
