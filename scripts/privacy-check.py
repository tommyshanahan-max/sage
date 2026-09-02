#!/usr/bin/env python3
"""What a stranger can find out about who runs these sites.

Answers one question, from the outside, using only public records: if somebody
looks up these domains and this box, does a person's name come back?

Four places a name leaks, checked in the order they are worth fixing:

  1. Domain registration. Registrar privacy is free at Porkbun and on by
     default, but "should be on" and "is on" are different claims, and only one
     of them is checkable.
  2. The address block. This should return the hosting company, never you.
     If it ever returns a person, something is very wrong.
  3. Reverse DNS. Blank unless somebody set it. A PTR record naming you is a
     self-inflicted wound and takes one console click to undo.
  4. Certificate Transparency. Every certificate issued is published within
     hours, so every hostname here is public whether or not it is linked. This
     does not leak a name, but it is what makes the hostnames findable, and
     people are regularly surprised by it.

Deliberately read-only, and deliberately over RDAP rather than port-43 WHOIS:
RDAP is HTTPS, so it works from behind a proxy and from inside networks that
block 43, and it returns structured data instead of a paragraph per registry.

    python3 scripts/privacy-check.py                # domains from .env
    python3 scripts/privacy-check.py example.com    # or name them
"""

import json
import os
import pathlib
import re
import socket
import ssl
import sys
import urllib.error
import urllib.request

REPO = pathlib.Path(__file__).resolve().parent.parent
TIMEOUT = 20

BOLD, DIM, RED, GREEN, YELLOW, OFF = (
    "\033[1m", "\033[2m", "\033[31m", "\033[32m", "\033[33m", "\033[0m"
)
if not sys.stdout.isatty():
    BOLD = DIM = RED = GREEN = YELLOW = OFF = ""

OK, WARN, BAD, UNKNOWN = f"{GREEN}ok{OFF}", f"{YELLOW}check{OFF}", f"{RED}exposed{OFF}", f"{DIM}?{OFF}"


def get(url, accept="application/json"):
    req = urllib.request.Request(url, headers={
        "Accept": accept,
        # RDAP servers and crt.sh both reject requests with no agent.
        "User-Agent": "privacy-check/1 (+self-audit)",
    })
    # Honours SSL_CERT_FILE where a proxy's CA bundle is in use; falls back to
    # the system store, which is what a plain VPS has.
    ctx = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or None)
    with urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx) as res:
        return json.loads(res.read().decode("utf-8", "replace"))


# ---------------------------------------------------------------------------
# Domains
# ---------------------------------------------------------------------------

# What a redacted registrant looks like. Registries word this a dozen ways and
# none of them is standardised, so the test is a list of the wordings actually
# in use rather than anything clever.
REDACTED = re.compile(
    r"redact|privacy|private|proxy|withheld|not disclosed|data protected"
    r"|whois ?guard|contact privacy|identity protection|gdpr|anonymi[sz]",
    re.I,
)


def vcard_fields(entity):
    """Name, org and email out of an RDAP jCard, which is a list of lists."""
    out = {}
    for item in (entity.get("vcardArray") or [None, []])[1]:
        if not isinstance(item, list) or len(item) < 4:
            continue
        key, value = item[0], item[3]
        if isinstance(value, list):
            value = " ".join(str(v) for v in value if v)
        if value:
            out.setdefault(key, str(value))
    return out


def registrant_of(data):
    """The registrant entity, wherever the registry chose to put it."""
    for entity in data.get("entities") or []:
        if "registrant" in (entity.get("roles") or []):
            return entity
        for nested in entity.get("entities") or []:
            if "registrant" in (nested.get("roles") or []):
                return nested
    return None


def check_domain(domain):
    try:
        data = get(f"https://rdap.org/domain/{domain}")
    except urllib.error.HTTPError as err:
        if err.code == 404:
            return UNKNOWN, "no RDAP record — not registered, or this TLD has none"
        return UNKNOWN, f"RDAP said {err.code}"
    except Exception as err:                       # network, DNS, TLS, timeout
        return UNKNOWN, f"could not ask ({type(err).__name__})"

    entity = registrant_of(data)
    if entity is None:
        # The commonest good outcome: the registry publishes no registrant at
        # all. Nothing to redact means nothing to find.
        return OK, "no registrant published"

    fields = vcard_fields(entity)
    # The verdict rests on the three fields that can actually name somebody. An
    # address or a phone number is shown but does not decide it: registries
    # routinely leave a bare "OR, US" behind on an otherwise redacted record,
    # and a checker that cries exposed at every one of those gets ignored,
    # which is the only way this can really fail.
    naming = {k: v for k, v in fields.items() if k in ("fn", "org", "email")}
    shown = "; ".join(f"{k}={v}" for k, v in fields.items()
                      if k in ("fn", "org", "email", "adr")) or "nothing published"

    if not naming or all(REDACTED.search(v) for v in naming.values()):
        return OK, f"redacted — {shown}"
    return BAD, f"published in the clear — {shown}"


# ---------------------------------------------------------------------------
# The box
# ---------------------------------------------------------------------------

def check_address(ip):
    lines = []

    try:
        data = get(f"https://rdap.org/ip/{ip}")
        name = data.get("name") or ""
        org = ""
        for entity in data.get("entities") or []:
            fields = vcard_fields(entity)
            org = fields.get("org") or fields.get("fn") or org
            if org:
                break
        who = org or name or "(unnamed)"
        # A hosting company here is the whole point: the public trail stops at
        # them, and going further needs legal process rather than a lookup.
        lines.append((OK, f"registered to {who}"))
    except Exception as err:
        lines.append((UNKNOWN, f"could not ask ({type(err).__name__})"))

    try:
        host = socket.gethostbyaddr(ip)[0]
        # A provider's automatic PTR embeds the address itself
        # (45.77.8.166.vultrusercontent.com, ec2-…compute.amazonaws.com) and
        # names nobody. Recognising that is worth the four lines: a checker that
        # says "look at this" about something correct every single time is a
        # checker people stop looking at.
        digits = ip.replace(".", "").replace(":", "")
        generated = digits in re.sub(r"[.\-]", "", host)
        lines.append((OK, f"reverse DNS is {host} — the provider's own, names nobody")
                     if generated else
                     (WARN, f"reverse DNS is {host} — read it, and make sure it names nobody"))
    except socket.herror:
        lines.append((OK, "no reverse DNS"))
    except Exception as err:
        lines.append((UNKNOWN, f"reverse DNS: {type(err).__name__}"))

    return lines


# ---------------------------------------------------------------------------
# What is already public
# ---------------------------------------------------------------------------

def certificate_names(domain):
    """Hostnames under this domain that appear in Certificate Transparency.

    Not a leak of identity — a leak of surface. Worth printing because the
    instinct that an unlinked hostname is unfindable is wrong, and every
    password on this box is the only thing between a found hostname and a
    shell."""
    try:
        rows = get(f"https://crt.sh/?q=%25.{domain}&output=json")
    except Exception:
        return None
    names = set()
    for row in rows:
        for name in str(row.get("name_value", "")).split("\n"):
            name = name.strip().lower()
            if name and not name.startswith("*"):
                names.add(name)
    return sorted(names)


# ---------------------------------------------------------------------------
# Repositories
# ---------------------------------------------------------------------------

def check_repo(full_name):
    """Public or not, asked without a token on purpose.

    Unauthenticated is the point: it answers the question actually being asked,
    which is what a stranger sees. A token would show your own private repos
    and report them as findable, which is the wrong answer given confidently.

    This matters more than any WHOIS setting. A public repo's commits carry the
    author's real name and email, and its README names the domains — a
    permanent, searchable link between the two that needs no legal process to
    follow. It is also a one-way door: making a repo private later stops new
    discovery but does not unpublish what was already fetched, forked or
    archived."""
    try:
        get(f"https://api.github.com/repos/{full_name}",
            accept="application/vnd.github+json")
        return BAD, "public — commits carry a real name and email"
    except urllib.error.HTTPError as err:
        if err.code == 404:
            return OK, "not visible without credentials"
        return UNKNOWN, f"GitHub said {err.code}"
    except Exception as err:
        return UNKNOWN, f"could not ask ({type(err).__name__})"


# ---------------------------------------------------------------------------

def registrable(host):
    """The bit that is actually registered. Right for .com/.io/.help; wrong for
    the likes of .co.uk, which none of these use — say so rather than guess."""
    parts = host.strip().strip(".").split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else host


def from_env(key, default=""):
    """One setting out of .env, read rather than sourced.

    `make` does not load .env — only docker compose does, for itself — so
    anything here that runs outside compose has to read the file. Read, never
    sourced: a `$` or a backtick inside a value would be expanded by a shell,
    and one of the values in that file is a password somebody generated."""
    env = REPO / ".env"
    if not env.exists():
        return os.environ.get(key, default)
    # An environment variable still wins, so a one-off override works.
    if os.environ.get(key):
        return os.environ[key]
    value = default
    for line in env.read_text().splitlines():
        m = re.match(rf"^\s*{re.escape(key)}\s*=\s*(.*?)\s*$", line)
        if m:                                   # last assignment wins, as compose does
            value = m.group(1).strip().strip('"').strip("'")
    return value


def domains_from_env():
    """Every hostname configured in .env, reduced to the domains behind them."""
    env = REPO / ".env"
    found = []
    if env.exists():
        for line in env.read_text().splitlines():
            m = re.match(r"^\s*([A-Z_0-9]*DOMAIN[A-Z_0-9]*)\s*=\s*(.+?)\s*$", line)
            if not m:
                continue
            value = m.group(2).strip().strip('"').strip("'")
            if value and "." in value and not value.endswith(".localhost"):
                found.append(registrable(value))
    for name in re.split(r"[\s,]+", from_env("TOMSCODING_PRIVACY_DOMAINS")):
        if name.strip():
            found.append(registrable(name.strip()))
    return sorted(set(found))


def main():
    domains = [registrable(a) for a in sys.argv[1:]] or domains_from_env()
    if not domains:
        print("No domains. Pass them as arguments, or run this where .env is.")
        return 1

    print(f"\n{BOLD}Who these are registered to{OFF}")
    print(f"{DIM}Public records only — this is what anyone can see.{OFF}\n")

    # Addresses are collected per domain rather than assumed to be one box.
    # They are not: a name can be parked at the registrar, or still pointing at
    # an older machine, and either of those is worth seeing next to the name.
    addresses = {}
    for domain in sorted(set(domains)):
        state, detail = check_domain(domain)
        print(f"  {domain:<24} {state:<18} {DIM}{detail}{OFF}")
        for host in (domain, "www." + domain):
            try:
                for ip in {info[4][0] for info in socket.getaddrinfo(host, None)}:
                    addresses.setdefault(ip, set()).add(host)
            except Exception:
                pass

    print(f"\n{BOLD}The machines behind them{OFF}")
    print(f"{DIM}One line per address these names actually resolve to.{OFF}\n")

    for ip in sorted(addresses):
        names = ", ".join(sorted(addresses[ip]))
        print(f"  {ip:<24} {DIM}{names}{OFF}")
        for state, detail in check_address(ip):
            print(f"  {'':<24} {state:<18} {DIM}{detail}{OFF}")
        print()

    repos = [r for r in re.split(r"[\s,]+",
             from_env("TOMSCODING_PRIVACY_REPOS")) if r.strip()]
    if repos:
        print(f"{BOLD}Repositories{OFF}")
        print(f"{DIM}Asked without a token, so this is what a stranger sees.{OFF}\n")
        for full_name in repos:
            state, detail = check_repo(full_name)
            print(f"  {full_name:<34} {state:<18} {DIM}{detail}{OFF}")
        print()

    print(f"{BOLD}Hostnames already public{OFF}")
    print(f"{DIM}From Certificate Transparency. Every certificate is published"
          f" within hours,\nso none of these is secret, linked or not.{OFF}\n")
    for domain in sorted(set(domains)):
        names = certificate_names(domain)
        if names is None:
            print(f"  {domain:<24} {DIM}could not reach crt.sh{OFF}")
        elif not names:
            print(f"  {domain:<24} {DIM}none yet{OFF}")
        else:
            print(f"  {domain}")
            for name in names:
                print(f"    {DIM}{name}{OFF}")

    print(f"""
{BOLD}What this does not cover{OFF}
  {DIM}Historical WHOIS. Privacy hides future lookups; archive services keep
  snapshots, so a domain registered with privacy off even briefly can stay
  recorded that way. This checks today's record only.

  The hosting account, billed to a real card and disclosable under legal
  process. No lookup shows that and no setting changes it.

  And the largest one: none of this touches the position of somebody
  physically in China, promoting the app in person, to people who know their
  name. See docs/PRIVACY.md in the study-pal repo, which works through the
  rest and is clear that the social footprint is bigger than the technical
  one.{OFF}
""")
    return 0


if __name__ == "__main__":
    sys.exit(main())
