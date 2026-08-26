# Deployment guide

## Local PostgreSQL acceptance

Prerequisite: Docker Desktop or Docker Engine with Compose.

```bash
docker compose up --build -d
docker compose ps
curl http://localhost:8000/health/ready
curl "http://localhost:8000/api/mandates?page_size=1"
docker compose logs --no-color db-init api
```

Expected readiness: `status=ok`, `database=connected`, `records=279`.

## Azure Container Apps

The repository includes a manual workflow at
`.github/workflows/deploy-azure.yml`. It follows Microsoft's Container Apps
deployment action and uses OpenID Connect instead of a long-lived Azure password.
It is manual so a push cannot accidentally create billable resources.

Create these resources first:

1. An Azure resource group.
2. An Azure Container Registry (ACR).
3. A Container Apps environment and Container App, or permission for the action to create them.
4. An Azure Database for PostgreSQL instance owned by the database teammate.
5. A GitHub `production` environment with an approval rule if available.

Configure GitHub environment secrets:

| Secret | Meaning |
|---|---|
| `AZURE_CLIENT_ID` | Federated deployment application's client ID |
| `AZURE_TENANT_ID` | Microsoft Entra tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `DATABASE_URL` | Full PostgreSQL SQLAlchemy URL |

Configure GitHub environment variables:

| Variable | Example |
|---|---|
| `AZURE_ACR_NAME` | `mandevalregistry` |
| `AZURE_CONTAINER_APP_NAME` | `mandeval-api` |
| `AZURE_RESOURCE_GROUP` | `rg-mandeval-demo` |
| `ALLOWED_ORIGINS` | `https://timeline.example.edu.au` |

Seed an empty production database from a trusted workstation or controlled job:

```bash
python -m pip install -r requirements.txt
python scripts/init_database.py --database-url "postgresql+psycopg://..."
```

Then run **Deploy API to Azure Container Apps** from GitHub Actions. The workflow
uses an immutable commit-SHA image tag and configures 0-2 replicas at 0.25 CPU and
0.5 GiB to keep demo costs low.

After deployment, verify:

```bash
curl https://YOUR-FQDN/health/live
curl https://YOUR-FQDN/health/ready
curl "https://YOUR-FQDN/api/mandates?jurisdiction=WA&page_size=5"
```

Official references:

- <https://learn.microsoft.com/azure/container-apps/github-actions>
- <https://github.com/Azure/container-apps-deploy-action>
- <https://learn.microsoft.com/azure/developer/github/connect-from-azure>

## Rollback

Container Apps keeps revisions. Route traffic back to the last known-good revision
in the Azure portal or with `az containerapp ingress traffic set`. Because images
are tagged with the Git commit SHA, the deployed artifact is traceable.

Database rollback is separate: take a backup before any approved `--replace` or
schema change. The deployment workflow never rebuilds production data automatically.
