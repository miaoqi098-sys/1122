#!/usr/bin/env python3
"""1122 Cloudflare write connector.

This program is intentionally allow-listed. It reads one command JSON file,
uses CLOUDFLARE_API_TOKEN from GitHub Actions Secrets, and performs only the
Cloudflare operations implemented below. Secrets are never printed.
"""

from __future__ import annotations

import json
import os
import pathlib
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[3]
CONNECTOR_DIR = pathlib.Path(__file__).resolve().parents[1]
CONFIG_PATH = CONNECTOR_DIR / "cloudflare.config.json"
API_BASE = "https://api.cloudflare.com/client/v4"


class ConnectorError(RuntimeError):
    pass


def load_json(path: pathlib.Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def cf_request(token: str, method: str, path: str, payload: dict | None = None, allow_404: bool = False):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        API_BASE + path,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "1122-cloudflare-command-bridge/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            data = json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        if allow_404 and e.code == 404:
            return None
        try:
            data = json.loads(raw)
            err = (data.get("errors") or [{}])[0]
            message = err.get("message") or raw or f"HTTP {e.code}"
            code = err.get("code")
        except Exception:
            message = raw or f"HTTP {e.code}"
            code = None
        suffix = f" (code {code})" if code is not None else ""
        raise ConnectorError(f"Cloudflare API HTTP {e.code}: {message}{suffix}") from e
    except urllib.error.URLError as e:
        raise ConnectorError(f"Cloudflare API network error: {e.reason}") from e

    if isinstance(data, dict) and data.get("success") is False:
        err = (data.get("errors") or [{}])[0]
        raise ConnectorError(err.get("message") or "Cloudflare API returned success=false")
    return data


def resolve_zone(token: str, config: dict) -> dict:
    name = config["zone_name"]
    q = urllib.parse.urlencode({"name": name})
    data = cf_request(token, "GET", f"/zones?{q}")
    result = data.get("result") or []
    if not result:
        raise ConnectorError(f"Zone not found: {name}")
    return result[0]


def assert_domain_allowed(domain: str, config: dict) -> None:
    zone = config["zone_name"].lower()
    domain = domain.lower().rstrip(".")
    if domain not in {zone, f"www.{zone}"}:
        raise ConnectorError(f"Domain is outside connector allow-list: {domain}")


def read_status(token: str, config: dict) -> dict:
    zone = resolve_zone(token, config)
    zone_id = zone["id"]
    account_id = config["account_id"]
    project = config["pages_project"]
    dns = cf_request(token, "GET", f"/zones/{zone_id}/dns_records?per_page=100")
    pages = cf_request(token, "GET", f"/accounts/{account_id}/pages/projects/{project}")
    domains = cf_request(token, "GET", f"/accounts/{account_id}/pages/projects/{project}/domains")
    return {
        "zone": {"name": zone.get("name"), "status": zone.get("status"), "paused": zone.get("paused")},
        "dns_record_count": len(dns.get("result") or []),
        "pages_project": {
            "name": (pages.get("result") or {}).get("name"),
            "subdomain": (pages.get("result") or {}).get("subdomain"),
            "production_branch": (pages.get("result") or {}).get("production_branch"),
        },
        "custom_domains": [d.get("name") for d in (domains.get("result") or [])],
    }


def read_custom_domain(token: str, config: dict, domain: str) -> dict | None:
    assert_domain_allowed(domain, config)
    account_id = config["account_id"]
    project = config["pages_project"]
    encoded = urllib.parse.quote(domain, safe="")
    data = cf_request(
        token,
        "GET",
        f"/accounts/{account_id}/pages/projects/{project}/domains/{encoded}",
        allow_404=True,
    )
    return None if data is None else data.get("result")


def bind_custom_domain(token: str, config: dict, domain: str) -> dict:
    assert_domain_allowed(domain, config)
    existing = read_custom_domain(token, config, domain)
    if existing:
        return {"changed": False, "reason": "already_bound", "domain": existing}
    account_id = config["account_id"]
    project = config["pages_project"]
    data = cf_request(
        token,
        "POST",
        f"/accounts/{account_id}/pages/projects/{project}/domains",
        {"name": domain},
    )
    return {"changed": True, "domain": data.get("result")}


def list_dns(token: str, config: dict) -> list[dict]:
    zone = resolve_zone(token, config)
    data = cf_request(token, "GET", f"/zones/{zone['id']}/dns_records?per_page=100")
    return [
        {
            "id": r.get("id"),
            "type": r.get("type"),
            "name": r.get("name"),
            "content": r.get("content"),
            "proxied": r.get("proxied"),
            "ttl": r.get("ttl"),
        }
        for r in (data.get("result") or [])
    ]


def upsert_dns(token: str, config: dict, params: dict) -> dict:
    record_type = str(params.get("type", "")).upper()
    name = str(params.get("name", "")).rstrip(".")
    content = str(params.get("content", ""))
    if record_type not in {"A", "AAAA", "CNAME", "TXT", "MX"}:
        raise ConnectorError(f"DNS type not allowed: {record_type}")
    if not name or not content:
        raise ConnectorError("dns.upsert_record requires params.name and params.content")
    assert_domain_allowed(name if name != "@" else config["zone_name"], config)

    zone = resolve_zone(token, config)
    zone_id = zone["id"]
    fqdn = config["zone_name"] if name == "@" else name
    q = urllib.parse.urlencode({"type": record_type, "name": fqdn})
    current = cf_request(token, "GET", f"/zones/{zone_id}/dns_records?{q}")
    matches = current.get("result") or []
    payload = {
        "type": record_type,
        "name": fqdn,
        "content": content,
        "ttl": int(params.get("ttl", 1)),
    }
    if record_type in {"A", "AAAA", "CNAME"} and "proxied" in params:
        payload["proxied"] = bool(params["proxied"])
    if record_type == "MX" and "priority" in params:
        payload["priority"] = int(params["priority"])

    if matches:
        record_id = matches[0]["id"]
        data = cf_request(token, "PUT", f"/zones/{zone_id}/dns_records/{record_id}", payload)
        return {"changed": True, "operation": "updated", "record": data.get("result")}
    data = cf_request(token, "POST", f"/zones/{zone_id}/dns_records", payload)
    return {"changed": True, "operation": "created", "record": data.get("result")}


def deploy_site(token: str, config: dict) -> dict:
    site_dir = ROOT / config["site_directory"]
    if not site_dir.is_dir():
        raise ConnectorError(f"Site directory not found: {site_dir}")
    env = os.environ.copy()
    env["CLOUDFLARE_API_TOKEN"] = token
    env["CLOUDFLARE_ACCOUNT_ID"] = config["account_id"]
    cmd = [
        "wrangler",
        "pages",
        "deploy",
        str(site_dir),
        "--project-name",
        config["pages_project"],
        "--branch",
        config.get("production_branch", "production"),
        "--commit-dirty=true",
    ]
    completed = subprocess.run(cmd, cwd=ROOT, env=env, text=True, capture_output=True)
    if completed.returncode != 0:
        safe_error = (completed.stderr or completed.stdout or "wrangler deployment failed")[-4000:]
        raise ConnectorError(safe_error)
    return {"changed": True, "deployment": "completed"}


def execute(command: dict, token: str, config: dict) -> dict:
    action = command.get("action")
    params = command.get("params") or {}
    command_id = command.get("command_id")
    if not command_id or not isinstance(command_id, str):
        raise ConnectorError("command_id is required")

    if action == "status.read":
        result = read_status(token, config)
    elif action == "pages.bind_custom_domain":
        result = bind_custom_domain(token, config, params.get("domain", config["zone_name"]))
    elif action == "pages.read_custom_domain":
        domain = params.get("domain", config["zone_name"])
        result = {"domain": read_custom_domain(token, config, domain)}
    elif action == "dns.list":
        result = {"records": list_dns(token, config)}
    elif action == "dns.upsert_record":
        if command.get("confirm") is not True:
            raise ConnectorError("dns.upsert_record requires confirm=true")
        result = upsert_dns(token, config, params)
    elif action == "website.publish":
        if command.get("confirm") is not True:
            raise ConnectorError("website.publish requires confirm=true")
        deployment = deploy_site(token, config)
        domain = bind_custom_domain(token, config, config["zone_name"])
        result = {"deployment": deployment, "custom_domain": domain, "status": read_status(token, config)}
    else:
        raise ConnectorError(f"Action not allowed: {action}")

    return {"ok": True, "command_id": command_id, "action": action, "result": result}


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: cloudflare_connector.py <command.json>", file=sys.stderr)
        return 2
    command_path = pathlib.Path(sys.argv[1]).resolve()
    commands_dir = (CONNECTOR_DIR / "commands").resolve()
    if commands_dir not in command_path.parents:
        print("command file must live under the connector commands directory", file=sys.stderr)
        return 2

    token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    if not token:
        print("CLOUDFLARE_API_TOKEN GitHub Actions Secret is not configured", file=sys.stderr)
        return 3

    try:
        config = load_json(CONFIG_PATH)
        command = load_json(command_path)
        output = execute(command, token, config)
        print(json.dumps(output, ensure_ascii=False, indent=2, default=str))
        return 0
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
