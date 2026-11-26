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

InRegia has a single maintainer, who owns the repository and holds all three roles.

| Role | Description | Members |
|---|---|---|
| Authors | Trusted to modify the source code without additional review | [Rotolino37](https://github.com/Rotolino37) (repository owner) |
| Reviewers | Review every change submitted by anyone who is not an author | [Rotolino37](https://github.com/Rotolino37) |
| Approvers | Approve each signing request | [Rotolino37](https://github.com/Rotolino37) |

Contributions from people outside this list are accepted only through pull requests reviewed by a reviewer. Every signing request for a release requires manual approval by an approver. All team members use multi-factor authentication on GitHub and SignPath.

## Privacy policy

This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it.

In detail:
- InRegia does not collect, store or send personal data, usage data or telemetry.
- The installer downloads only the components the user selects: the application package and the default music from this repository's GitHub releases, and LibreOffice from The Document Foundation (download.documentfoundation.org).
- Inside the app, the same downloads happen only when the user presses the corresponding button.
- Presentations and music stay on the user's computer.

Third-party services involved in these downloads have their own privacy policies: [GitHub](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement) and [The Document Foundation](https://www.documentfoundation.org/privacy).
