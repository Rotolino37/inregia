# Code signing policy

Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org).

## Scope

Signed artifacts, once the project is approved by SignPath Foundation:

- `InRegia-Setup-<version>.exe`, the installer
- `InRegia.exe` inside `InRegia-app-win-x64.zip`, the application

Third-party binaries shipped with the application (the Electron runtime and its libraries) are not represented as InRegia code. LibreOffice is never redistributed: the installer downloads the official package from The Document Foundation.

## Build and release process

- Every signed artifact is built by GitHub Actions on GitHub-hosted runners, from the public source code of this repository, by the workflow [`.github/workflows/build.yml`](.github/workflows/build.yml).
- Release artifacts are built only from tags `v*` on the `main` branch.
- No artifact is uploaded, modified or signed outside this workflow.

## Roles

| Role | Members |
|---|---|
| Committers and reviewers | [Saggiaa](https://github.com/Saggiaa) |
| Approvers | [Saggiaa](https://github.com/Saggiaa) |

Every signing request for a release requires manual approval by an approver. All team members use multi-factor authentication on GitHub and SignPath.

## Privacy

InRegia does not collect, store or transmit personal data or usage data. It connects to the internet only when the user asks for it: to download LibreOffice from The Document Foundation and the default background music from this repository's releases.
