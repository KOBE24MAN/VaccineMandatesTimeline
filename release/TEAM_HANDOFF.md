# Team Handoff

## Public Demo

The deployed client demo is available at:

https://mandeval-timeline-demo.whitesea-84fcda14.australiaeast.azurecontainerapps.io/

The client launcher in `release/Client_Demo_Package` checks the public readiness endpoint and opens this URL. It does not require Docker or Azure credentials.

## Architecture

The demo uses one container. A React production build is served by FastAPI, and all API reads use an immutable SQLite database included in the image. Excel and CSV source files are not loaded at runtime and are not copied into the runtime image.

## Azure Resources

- Resource group: `mandeval-demo-rg`
- Registry: `mandevalg5uwa2026.azurecr.io`
- Container Apps environment: `mandeval-demo-env`
- Container App: `mandeval-timeline-demo`
- Region: Australia East
- Image digest: `sha256:c70f3481e3d821da20c793e0097448b37d51fb2a4b86a4c447f24c5fa07d7898`
- Managed identity: `mandeval-pull-identity`

The app uses 0.25 CPU and 0.5 GiB memory with one minimum and one maximum replica. Registry admin access remains disabled; the Container App pulls the image through the managed identity.

## Local Operation

The simplest local fallback does not require Docker:

1. Double-click `Start-Local-Demo.bat` in the repository root.
2. Wait for `[OK] The demo is ready`.
3. Use `http://localhost:8000/`.
4. Double-click `Stop-Local-Demo.bat` when finished.

Docker Desktop has a workstation-specific socket startup issue. A working Docker Engine is available in Ubuntu WSL 2 for image builds and container testing.

## Data Rebuild

Run the following command only when the approved workbook changes:

```powershell
.venv\Scripts\python.exe scripts\build_demo_data.py --source "..\Modification Brief\all_mandates.xlsx" --version demo-2026-08-26
```

Review the generated manifest, rerun all tests and acceptance checks, build a new immutable image tag, and deploy a new Container Apps revision. Never overwrite source data to resolve an uncertain date without client approval.

## Future Deployment

The current deployment was performed directly from `zijun-branch`. The workflow template at `.github/workflows/deploy-azure.yml` is not the authoritative deployment path until the team configures GitHub OIDC permissions and validates it in this repository.

For a manual update:

1. Rebuild and test `Dockerfile.demo`.
2. Push a new unique image tag to `mandevalg5uwa2026.azurecr.io`.
3. Update `mandeval-timeline-demo` to the new image digest.
4. Confirm the revision is healthy before removing or deactivating the prior revision.
5. Repeat the public API and browser acceptance checks.

## Cost Control

The app currently keeps one replica ready for the scheduled demonstration. After the demonstration period, the team can set the minimum replica count to zero to reduce idle consumption, accepting a possible cold-start delay.

## Recovery

If a new revision is unhealthy, route traffic back to the most recent healthy revision. The deployed database is immutable, so restarting or replacing a replica does not alter the 279-record release snapshot.
