# Team Handoff

## Architecture

The final demo uses one container. A React production build is served by FastAPI, and all API reads use an immutable SQLite database included in the image. The Excel source file is never loaded at runtime and is not copied into the image.

## Local Operation

1. Start Docker Desktop.
2. Double-click `Start-Local-Demo.bat` in the repository root.
3. Wait for `[OK] The demo is ready` and use the browser window that opens.
4. Double-click `Stop-Local-Demo.bat` when finished.

The fixed container name is `mandeval-demo`. The local URL is `http://localhost:8000/`.

## Data Rebuild

Run the following command only when the approved workbook changes:

```powershell
.venv\Scripts\python.exe scripts\build_demo_data.py --source "..\Modification Brief\all_mandates.xlsx" --version demo-2026-08-26
```

Review `data/release/release-manifest.json`, rerun all acceptance checks, and update the release version before deployment.

## Azure Deployment

The workflow `.github/workflows/deploy-azure.yml` uses GitHub OIDC, Azure Container Registry, and Azure Container Apps. It builds `Dockerfile.demo`, deploys one replica, verifies `/health/ready`, injects the deployed URL into the client package, and uploads that package as a workflow artifact.

Required GitHub secrets:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

Required GitHub variables:

- `AZURE_ACR_NAME`
- `AZURE_CONTAINER_APP_NAME`
- `AZURE_CONTAINER_APP_ENVIRONMENT`
- `AZURE_RESOURCE_GROUP`

No database password or external database URL is required.

## Recovery

If a deployment is unhealthy, use Azure Container Apps revision management to route traffic back to the previously healthy revision. If local startup fails, run `Stop-Local-Demo.bat`, confirm Docker Desktop is ready, and run `Start-Local-Demo.bat` again.
