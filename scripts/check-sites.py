#!/usr/bin/env python3
"""Check that every Caddy site block resolves to a usable, unique address.

This exists because of a real outage. Caddy's {$VAR:default} substitutes the
default only when the variable is *unset*; a variable set to an empty string
stays empty. An empty site address is not a warning — Caddy rejects the entire
config and serves nothing, so one unconfigured optional site takes down the
sites that were configured correctly.

Two addresses that are merely identical fail the same way.

Run with no arguments to check the deployment's own preset both fully
configured and with nothing optional set:

    python3 scripts/check-sites.py
"""

import json
import pathlib
import re
import subprocess
import sys
import tempfile

REPO = pathlib.Path(__file__).resolve().parent.parent


def compose_caddy_env(env_file):
    result = subprocess.run(
        ["docker", "compose", "--env-file", str(env_file), "config", "--format", "json"],
        capture_output=True, text=True, cwd=REPO,
    )
    if result.returncode:
        return None, result.stderr.strip().splitlines()[-1] if result.stderr else "compose failed"
    return json.loads(result.stdout)["services"]["caddy"]["environment"], None


def site_addresses(env):
    """Resolve each site block's address the way Caddy actually does."""
    sites = []
    for path in sorted((REPO / "docker" / "sites").glob("*.caddy")):
        match = re.search(r"^\{\$([A-Z_0-9]+)(?::([^}]*))?\}\s*\{", path.read_text(), re.M)
        if match:
            var, default = match.group(1), match.group(2)
            value = env[var] if var in env else (default or "")
            sites.append((path.name, var, value))
    main = re.search(r"^\{\$([A-Z_0-9]+)\}\s*\{", (REPO / "docker" / "Caddyfile").read_text(), re.M)
    if main:
        sites.append(("Caddyfile", main.group(1), env.get(main.group(1), "")))
    return sites


def check(label, env_file):
    env, error = compose_caddy_env(env_file)
    if error:
        print(f"{label}: compose config failed\n  {error}")
        return False

    ok, seen = True, {}
    for name, var, value in site_addresses(env):
        if not value:
            note, ok = "EMPTY — Caddy would reject the whole config", False
        elif value in seen:
            note, ok = f"DUPLICATE of {seen[value]} — startup failure", False
        else:
            seen[value] = name
            note = "ok"
        print(f"  {name:22} {var:28} {value or '(empty)':26} {note}")

    print(f"{label}: {'PASS' if ok else 'FAIL'}\n")
    return ok


def main():
    preset = (REPO / "env.tomscoding").read_text()
    secrets = (
        "TOMSCODING_PASSWORD=x\nTOMSCODING_PASSWORD_2=x\n"
        "TOMSCODING_BROWSER_PASSWORD=x\nTOMSCODING_AGENT_PASSWORD=x\n"
        "ANTHROPIC_API_KEY=sk-test\n"
    )
    minimal = (
        "TOMSCODING_DOMAIN=code.example.com\n"
        "TOMSCODING_ACME_EMAIL=you@example.com\n"
        "TOMSCODING_PASSWORD=x\n"
    )

    with tempfile.TemporaryDirectory() as tmp:
        full = pathlib.Path(tmp) / "full.env"
        full.write_text(
            preset.replace("COMPOSE_PROFILES=seat2", "COMPOSE_PROFILES=seat2,browser,agent")
            + secrets
        )
        bare = pathlib.Path(tmp) / "bare.env"
        bare.write_text(minimal)

        print("Every optional site configured:")
        a = check("full", full)
        print("Nothing optional configured:")
        b = check("bare", bare)

    return 0 if (a and b) else 1


if __name__ == "__main__":
    sys.exit(main())
