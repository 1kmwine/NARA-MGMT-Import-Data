# -*- coding: utf-8 -*-
"""Redeploy backend+frontend to the dev server (docker compose).

Usage:
    pip install paramiko
    DEPLOY_HOST=192.168.47.105 DEPLOY_USER=root DEPLOY_PASSWORD=... python deploy/deploy.py

Uploads docker-compose.yml + backend/ + frontend/ (source only, no
node_modules/.cache/.next), then `docker compose build && up -d` on the
server. .env files are uploaded too (they're gitignored, read from your
local backend/.env and frontend/.env).

First-time setup on a fresh server also needs the import_data_app/
import_data_ro MariaDB accounts and an initial `docker compose up -d
--no-start` + cache seed — not part of this routine-redeploy script.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ssh_helper as ssh

REPO_ROOT = Path(__file__).resolve().parent.parent
REMOTE_DIR = "/var/www/NARA-MGMT-Import-Data"


def safe(s):
    return (s or "").encode("ascii", "replace").decode("ascii")


def step(name, code, out, err):
    print(f"=== {name} (exit {code}) ===")
    if out:
        print(safe(out[-3000:]))
    if err:
        print("STDERR:", safe(err[-3000:]))
    print()


def main():
    print("Uploading docker-compose.yml...")
    ssh.put(str(REPO_ROOT / "docker-compose.yml"), REMOTE_DIR + "/docker-compose.yml")

    print("Uploading backend/...")
    ssh.put_dir(str(REPO_ROOT / "backend"), REMOTE_DIR + "/backend",
                exclude={".cache", "__pycache__", "static_legacy_wine_only", "static"})
    ssh.put(str(REPO_ROOT / "backend" / ".env"), REMOTE_DIR + "/backend/.env")

    print("Uploading frontend/...")
    ssh.put_dir(str(REPO_ROOT / "frontend"), REMOTE_DIR + "/frontend",
                exclude={"node_modules", ".next", ".env.local"})
    ssh.put(str(REPO_ROOT / "frontend" / ".env"), REMOTE_DIR + "/frontend/.env")

    print("Building images (a few minutes)...")
    code, out, err = ssh.run(f"cd {REMOTE_DIR} && docker compose build", timeout=600)
    step("docker compose build", code, out, err)

    print("Restarting...")
    code, out, err = ssh.run(f"cd {REMOTE_DIR} && docker compose up -d", timeout=120)
    step("docker compose up -d", code, out, err)


if __name__ == "__main__":
    main()
