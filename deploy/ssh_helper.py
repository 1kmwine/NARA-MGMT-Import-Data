# -*- coding: utf-8 -*-
"""Minimal paramiko wrapper for deploying to the dev server.

Credentials come from env vars (never hardcode them here / never commit them):
    DEPLOY_HOST      e.g. 192.168.47.105
    DEPLOY_USER      e.g. root
    DEPLOY_PASSWORD  see NARA-Information-Digest/docs/ARCHITECTURE.md §7
"""
import os
import posixpath
import paramiko


def _creds():
    host = os.environ["DEPLOY_HOST"]
    user = os.environ["DEPLOY_USER"]
    password = os.environ["DEPLOY_PASSWORD"]
    return host, user, password


def client():
    host, user, password = _creds()
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, username=user, password=password, timeout=15)
    return c


def run(cmd, timeout=120):
    c = client()
    try:
        stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
        out = stdout.read().decode("utf-8", "replace")
        err = stderr.read().decode("utf-8", "replace")
        code = stdout.channel.recv_exit_status()
        return code, out, err
    finally:
        c.close()


def put(local_path, remote_path, makedirs=True):
    c = client()
    try:
        sftp = c.open_sftp()
        if makedirs:
            _mkdir_p(sftp, posixpath.dirname(remote_path))
        sftp.put(local_path, remote_path)
        sftp.close()
    finally:
        c.close()


def put_dir(local_dir, remote_dir, exclude=None):
    exclude = exclude or set()
    c = client()
    try:
        sftp = c.open_sftp()
        _mkdir_p(sftp, remote_dir)
        for root, dirs, files in os.walk(local_dir):
            dirs[:] = [d for d in dirs if d not in exclude]
            rel = os.path.relpath(root, local_dir)
            remote_root = remote_dir if rel == "." else posixpath.join(remote_dir, rel.replace(os.sep, "/"))
            _mkdir_p(sftp, remote_root)
            for f in files:
                if f in exclude:
                    continue
                sftp.put(os.path.join(root, f), posixpath.join(remote_root, f))
        sftp.close()
    finally:
        c.close()


def _mkdir_p(sftp, remote_dir):
    parts = remote_dir.strip("/").split("/")
    path = ""
    for p in parts:
        path += "/" + p
        try:
            sftp.stat(path)
        except FileNotFoundError:
            sftp.mkdir(path)
