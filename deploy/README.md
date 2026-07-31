# Deploy

Manual, no CI/CD (matches the hub's other blocks). Dev server runs both
services via `docker-compose.yml` at the repo root.

```bash
pip install paramiko
export DEPLOY_HOST=192.168.47.105
export DEPLOY_USER=root
export DEPLOY_PASSWORD='...'   # NARA-Information-Digest/docs/ARCHITECTURE.md §7
python deploy/deploy.py
```

Ports on the server: backend `8010:8000`, frontend `3001:3000`. Hub block
`m11` (수입데이터) points its `externalUrl` at `http://192.168.47.105:3001/`.

First deploy to a fresh server also needs (not scripted, one-off):
- MariaDB `import_data` schema + `import_data_app`/`import_data_ro` accounts
- `docker compose up -d --no-start`, seed `.cache` volume, then `up -d`
