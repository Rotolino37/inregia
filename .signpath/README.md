# SignPath setup

Reference configuration for [SignPath Foundation](https://signpath.org) code signing. See [CODE_SIGNING_POLICY.md](../CODE_SIGNING_POLICY.md).

After the project is approved:

1. In SignPath create the project with slug `inregia`, linked to this GitHub repository.
2. Create two artifact configurations with the content of the files in `artifact-configurations/`: slugs `app-zip` and `setup-exe`.
3. Create the signing policies `test-signing` and `release-signing` (manual approval for release).
4. In GitHub, Settings > Secrets and variables > Actions:
   - secret `SIGNPATH_API_TOKEN`: API token of a SignPath CI user with submitter role;
   - variable `SIGNPATH_ORGANIZATION_ID`: the organization ID from the SignPath dashboard URL.

From the next build the workflow signs `InRegia.exe` and the installer automatically. Until the variable exists the signing steps are skipped.
