SHELL := /bin/bash
COMPOSE := docker compose

.DEFAULT_GOAL := help

.PHONY: help up deploy down restart reload rebuild logs shell shell-2 claude ps backup check doctor privacy password fix-browser instructions partner-sync partner-sync-2 feed-sync partner-mockups whats-new feed-people feed-posts numbers-days app-check

help: ## Show this help
	grep -hE '^[a-z0-9-]+:.*?## ' $(MAKEFILE_LIST) | awk -F':.*?## ' '{printf "  \033[1m%-10s\033[0m %s\n", $$1, $$2}'

deploy: ## Fetch the latest commits, then build and start everything
	@# Why this exists, given that 'up' is one word shorter.
	@#
	@# 'up' builds what is on this disk. It does not fetch, and there is nothing
	@# in its output that says so: the images all rebuild, every container
	@# reports Running or Recreated, and a deploy that shipped nothing looks
	@# exactly like one that shipped everything. That cost an afternoon once,
	@# with the new code sitting on GitHub and three people reading a page that
	@# could not have contained it.
	@#
	@# --ff-only rather than a merge: a deploy is not the place to resolve a
	@# conflict, and a checkout that has drifted should say so and stop rather
	@# than build something nobody wrote.
	@git rev-parse --git-dir >/dev/null 2>&1 \
	  || { echo "not a git checkout — you are in $$(pwd)."; \
	       echo "Run this in the folder holding .env on the server, not on your laptop."; \
	       exit 1; }
	@branch=$$(git rev-parse --abbrev-ref HEAD); \
	  echo "fetching origin/$$branch"; \
	  git pull --ff-only origin "$$branch" \
	  || { echo; echo "could not fast-forward $$branch."; \
	       echo "Either this checkout has local commits, or the work is on another branch."; \
	       echo "Check with: git status -sb && git log --oneline -3"; \
	       exit 1; }
	@$(MAKE) --no-print-directory up

up: ## Build if needed and start everything (does NOT fetch — see 'deploy')
	test -f .env || { echo "no .env — run: cp .env.example .env && \$$EDITOR .env"; exit 1; }
	@grep -q '^COMPOSE_PROFILES=.*seat2' .env && ! grep -qE '^TOMSCODING_PASSWORD_2=.+' .env \
	  && { echo "seat2 is enabled but TOMSCODING_PASSWORD_2 is empty."; \
	       echo "Run 'make password' and set it, or clear COMPOSE_PROFILES for a single seat."; \
	       exit 1; } || true
	@grep -q '^COMPOSE_PROFILES=.*browser' .env && ! grep -qE '^TOMSCODING_BROWSER_PASSWORD=.+' .env \
	  && { echo "browser is enabled but TOMSCODING_BROWSER_PASSWORD is empty."; \
	       echo "Add one, or drop 'browser' from COMPOSE_PROFILES."; \
	       exit 1; } || true
	@grep -q '^COMPOSE_PROFILES=.*agent' .env && ! grep -qE '^TOMSCODING_AGENT_PASSWORD=.+' .env \
	  && { echo "agent is enabled but TOMSCODING_AGENT_PASSWORD is empty."; \
	       echo "That page drives an agent with your API key — it needs a password."; \
	       exit 1; } || true
	@grep -q '^COMPOSE_PROFILES=.*agent' .env && ! grep -qE '^ANTHROPIC_API_KEY=.+' .env \
	  && { echo "agent is enabled but ANTHROPIC_API_KEY is empty."; \
	       echo "The agent has nothing to authenticate with and every turn will fail."; \
	       exit 1; } || true
	@grep -q '^COMPOSE_PROFILES=.*partner' .env && ! grep -qE '^TOMSCODING_PARTNER_PASSWORD=.+' .env \
	  && { echo "partner is enabled but TOMSCODING_PARTNER_PASSWORD is empty."; \
	       echo "That seat is someone else's access to your work — it needs its own password."; \
	       exit 1; } || true
	@grep -q '^COMPOSE_PROFILES=.*partner' .env && [ ! -d partner/source ] \
	  && { echo "partner is enabled but there is no snapshot yet."; \
	       echo "Run 'make partner-sync' first — it decides which repos and versions they see."; \
	       exit 1; } || true
	@grep -q '^COMPOSE_PROFILES=.*partner2' .env && ! grep -qE '^TOMSCODING_PARTNER2_PASSWORD=.+' .env \
	  && { echo "partner2 is enabled but TOMSCODING_PARTNER2_PASSWORD is empty."; \
	       echo "That seat is someone else's access to your work — it needs its own password."; \
	       exit 1; } || true
	@grep -q '^COMPOSE_PROFILES=.*partner2' .env && [ ! -d partner/source-2 ] \
	  && { echo "partner2 is enabled but it has no snapshot yet."; \
	       echo "Run 'make partner-sync-2' first — it decides which repos and versions they see."; \
	       exit 1; } || true
	@grep -q '^COMPOSE_PROFILES=.*thefeed' .env && ! grep -qE '^TOMSCODING_FEED_PASSWORD=.+' .env \
	  && { echo "thefeed is enabled but TOMSCODING_FEED_PASSWORD is empty."; \
	       echo "That seat moderates a live board — it needs its own password."; \
	       exit 1; } || true
	@grep -q '^COMPOSE_PROFILES=.*thefeed' .env && [ ! -d partner/source-feed ] \
	  && { echo "thefeed is enabled but it has no snapshot yet."; \
	       echo "Run 'make feed-sync' first — it decides which repos and versions that seat sees."; \
	       exit 1; } || true
	@grep -q '^COMPOSE_PROFILES=.*thefeed' .env && ! grep -qE '^TOMSCODING_BOARD_KEY=.+' .env \
	  && { echo "thefeed is enabled but TOMSCODING_BOARD_KEY is empty."; \
	       echo "That seat could not reach the queue — moderating is the job it exists for."; \
	       exit 1; } || true
	@grep -q '^COMPOSE_PROFILES=.*thefeed' .env \
	  && grep -qE '^TOMSCODING_FEED_DOMAIN=' .env \
	  && [ "$$(sed -n 's/^TOMSCODING_FEED_DOMAIN=//p' .env | tail -1 | tr -d '"')" \
	     = "$$(sed -n 's/^TOMSCODING_PARTNER_DOMAIN=//p' .env | tail -1 | tr -d '"')" ] \
	  && { echo "TOMSCODING_FEED_DOMAIN is the same as TOMSCODING_PARTNER_DOMAIN."; \
	       echo "Two Caddy site blocks on one address is a startup failure, and it takes"; \
	       echo "every site on this box down with it. Give the new seat its own hostname."; \
	       exit 1; } || true
	@grep -q '^COMPOSE_PROFILES=.*analytics' .env && ! grep -qE '^TOMSCODING_STATS_PASSWORD=.+' .env \
	  && echo "note: no TOMSCODING_STATS_PASSWORD — the numbers page will be open to anyone with the address." || true
	@grep -q '^COMPOSE_PROFILES=.*analytics' .env && ! grep -qE '^TOMSCODING_STATS_SITES=.+' .env \
	  && { echo "analytics is enabled but TOMSCODING_STATS_SITES is empty."; \
	       echo "Nothing would be counted: a page whose origin is not listed is ignored."; \
	       exit 1; } || true
	@grep -q '^COMPOSE_PROFILES=.*board' .env && ! grep -qE '^TOMSCODING_BOARD_KEY=.+' .env \
	  && { echo "board is enabled but TOMSCODING_BOARD_KEY is empty."; \
	       echo "Every post lands held for a person to look at, and without this key"; \
	       echo "there is no person: the admin routes refuse everything, so nothing"; \
	       echo "could ever be released. Run 'make password' and put it in .env."; \
	       exit 1; } || true
	@grep -q '^COMPOSE_PROFILES=.*board' .env && ! grep -qE '^TOMSCODING_BOARD_SALT=.+' .env \
	  && echo "note: no TOMSCODING_BOARD_SALT — device hashes are unsalted, so a hash is a lookup away from the id it came from." || true
	@# Two Caddy site blocks on one address is a startup failure, and Caddy
	@# failing to start takes every site on this box with it — the seats, the
	@# agent, the app's counter. The likeliest way to cause it is moving a
	@# hostname from one product to another and setting the new one before
	@# clearing the old. Caught here, where the cost is a message, rather than
	@# on the box, where the cost is everything being down.
	@b=$$(grep -E '^TOMSCODING_BOARD_DOMAIN=' .env | cut -d= -f2- | tr -d '"' ); \
	 n=$$(grep -E '^TOMSCODING_BRAND_DOMAIN=' .env | cut -d= -f2- | tr -d '"' ); \
	 if [ -n "$$b" ] && [ "$$b" = "$$n" ]; then \
	   echo "TOMSCODING_BOARD_DOMAIN and TOMSCODING_BRAND_DOMAIN are both $$b."; \
	   echo "Caddy would refuse to start and take every site here down with it."; \
	   echo "Move the brand to its own hostname first, deploy, and give this one"; \
	   echo "to the board after that has come up."; \
	   exit 1; \
	 fi
	@grep -qE '^TOMSCODING_BOARD_DOMAIN=.+' .env && ! grep -q '^COMPOSE_PROFILES=.*board' .env \
	  && { echo "TOMSCODING_BOARD_DOMAIN is set but 'board' is not in COMPOSE_PROFILES."; \
	       echo "Caddy would answer that hostname with a 502: a certificate, a public"; \
	       echo "address, and nothing behind it."; \
	       exit 1; } || true
	@# Stamp what is being deployed before deploying it, so the agent's copy of
	@# "recent changes" is the commits that are actually running. Not fatal — a
	@# tarball instead of a checkout should still deploy — but it says so out
	@# loud when it fails. The first version of this swallowed its own error and
	@# wrote nothing on the box for a whole deploy without anyone noticing.
	@sh scripts/whats-new.sh 	  || echo "note: could not stamp the commit list; Sage will not know what changed"
	$(COMPOSE) up -d --build
	@# Caddy's site files are bind-mounted, so editing one changes nothing that
	@# compose can see: the service definition is identical, the container is
	@# left Running rather than recreated, and Caddy keeps serving the config it
	@# loaded at boot. A new hostname or a new redirect then does not exist, and
	@# the deploy that shipped it says every container is fine.
	@#
	@# So reload after every up. It is a no-op when nothing changed and it drops
	@# no connections. It never fails the deploy: on a first run the container
	@# may not be up yet, and a containers-are-started deploy reporting failure
	@# because of that would be worse than the note it prints instead. A config
	@# Caddy refuses is caught by `make check`, which is where that belongs.
	@$(COMPOSE) exec -T caddy caddy reload --config /etc/caddy/Caddyfile 2>/dev/null \
	  && echo "caddy reloaded" \
	  || echo "note: caddy not reloaded (not running yet?) — run 'make reload' if a site is missing"
	echo "up. https://$$(grep -E '^TOMSCODING_DOMAIN=' .env | cut -d= -f2-)"

down: ## Stop everything (volumes are kept)
	$(COMPOSE) down

restart: ## Restart all services
	$(COMPOSE) restart

partner-sync: ## Replace the snapshot the partner seat can see
	bash scripts/partner-sync.sh 1

partner-sync-2: ## Same, for the second partner seat
	bash scripts/partner-sync.sh 2

feed-sync: ## Replace the snapshot The Feed's seat can see
	bash scripts/partner-sync.sh feed

board-reset: ## Empty the board — every person, post and photograph
	@# For handing a clean app to people who have not seen it. Runs in the
	@# board's own container, which is where the volume is mounted; this box
	@# has Docker and no node.
	@#
	@# Prints what is there and changes nothing unless you add YES=1. It keeps
	@# a stamped copy beside the original — "start again" is a thing people ask
	@# for twice, once meaning it — and tells you the command that removes the
	@# copy when you are sure. NOBACKUP=1 skips the copy.
	@#
	@# The counter is a different service with a different volume and is not
	@# touched: visits and the daily figures survive this.
	@#
	@# The feature votes do NOT. They are rows in the board's own file and go
	@# with everything else — what survives is the counter's record that a
	@# button was pressed on a given day, which is a count and not a list. If
	@# the standing totals matter, read them from /api/count before you run
	@# this; there is nowhere to get them back from afterwards.
	$(COMPOSE) run --rm --no-deps -T \
	  -v "$(CURDIR)/scripts:/seed:ro" \
	  --entrypoint node board \
	  /seed/board-reset.mjs $(if $(YES),--yes,) $(if $(NOBACKUP),--no-backup,)

feed-people: ## Put the demo people on The Feed (roster in scripts/people.json)
	@# Run inside the board's own container, not on the host. This box has
	@# Docker and no node — everything here runs in an image — so a script
	@# that needs a runtime has to borrow one, and the board's image already
	@# has the right version of it.
	@#
	@# It reaches the board over the compose network by service name, which
	@# also means this works before DNS, behind Caddy, and if the public
	@# hostname is wrong. Read-only mount: the container runs the script and
	@# cannot change it.
	@#
	@# Photographs, if you have them on the box: put the files in
	@# scripts/photos named after the people (wen.jpg), then
	@#   make feed-people PHOTOS=/seed/photos
	@# Easier from a browser — the panel's People tab takes a file per person
	@# and needs no shell at all.
	@grep -qE '^TOMSCODING_BOARD_KEY=.+' .env \
	  || { echo "TOMSCODING_BOARD_KEY is not set in .env — the board would refuse this."; exit 1; }
	$(COMPOSE) run --rm --no-deps -T \
	  -v "$(CURDIR)/scripts:/seed:ro" \
	  --entrypoint node board \
	  /seed/seed-people.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --people /seed/people.json $(if $(PHOTOS),--photos $(PHOTOS),)

app-check: ## Can this box reach Study Pal's counter? Ask it directly
	@# The app figures come from another machine. When that fetch fails they
	@# all empty at once and the page cannot say why, so this asks from
	@# inside the container that makes the call, with the same address and
	@# the same key it uses.
	$(COMPOSE) run --rm --no-deps -T \
	  -v "$(CURDIR)/scripts:/seed:ro" \
	  --entrypoint node analytics /seed/app-check.mjs

numbers-days: ## What happened on which day, printed rather than drawn
	@# Runs in a container built from the analytics image, so the token comes
	@# from the environment rather than from anybody's clipboard, and reaches
	@# the running service by name over the compose network.
	@#
	@# The dashboard's curve answers "is it going up". This answers "which
	@# afternoon" — the question you have when a week's figures turn out to
	@# be almost all from one of them.
	@#   make numbers-days DAYS=30
	$(COMPOSE) run --rm --no-deps -T \
	  -v "$(CURDIR)/scripts:/seed:ro" \
	  --entrypoint node analytics /seed/numbers-days.mjs $(or $(DAYS),14)

feed-posts: ## Give the demo people a history — posts, replies and likes
	@# Run after `make feed-people`. Writes three weeks of posts dated back
	@# through those weeks, and moves the joining announcements to match, so
	@# the board reads as somewhere that has been running rather than
	@# somewhere switched on this morning. Safe to run twice: it looks for
	@# its own first lines on the board and stops if they are there.
	@grep -qE '^TOMSCODING_BOARD_KEY=.+' .env \
	  || { echo "TOMSCODING_BOARD_KEY is not set in .env — the board would refuse this."; exit 1; }
	$(COMPOSE) run --rm --no-deps -T \
	  -v "$(CURDIR)/scripts:/seed:ro" \
	  --entrypoint node board \
	  /seed/seed-posts.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)"

partner-mockups: ## Copy every seat's mockups out to ./mockups for review
	@mkdir -p mockups/partner mockups/partner-2 mockups/thefeed
	@$(COMPOSE) cp partner:/work/mockups/. mockups/partner/ 2>/dev/null \
	  || echo "  (seat 1: not running, or nothing made yet)"
	@$(COMPOSE) cp partner-2:/work/mockups/. mockups/partner-2/ 2>/dev/null \
	  || echo "  (seat 2: not running, or nothing made yet)"
	@$(COMPOSE) cp thefeed:/work/mockups/. mockups/thefeed/ 2>/dev/null \
	  || echo "  (the feed: not running, or nothing made yet)"
	@find mockups -name '*.html' -printf '%TY-%Tm-%Td %TH:%TM  %p\n' 2>/dev/null | sort -r || true

instructions: ## Update the agent instructions in the running workspace
	@# The image seeds these into the home volume on first start only, and the
	@# volume masks the image path from then on — so a rebuild leaves a running
	@# deployment on whatever it was first given. This copies the current files
	@# over the top. Sage reads the same volume, so it picks them up too, with
	@# no restart needed.
	@echo "this overwrites ~/.claude/CLAUDE.md and ~/.claude/tomscoding.md in the workspace."
	@echo "any edits made to them in the IDE will be lost."
	@printf 'continue? [y/N] ' && read a && [ "$$a" = y ]
	$(COMPOSE) cp docker/workspace/CLAUDE.md workspace:/home/coder/.claude/CLAUDE.md
	$(COMPOSE) cp docker/workspace/tomscoding.md workspace:/home/coder/.claude/tomscoding.md
	@echo "done. new conversations pick these up; existing ones need a fresh start."

fix-browser: ## Restart the browser after a black screen
	$(COMPOSE) restart browser
	@echo "give it a minute, then reload https://$$(grep -E '^TOMSCODING_BROWSER_DOMAIN=' .env | cut -d= -f2-)"

reload: ## Reload Caddy config without dropping connections
	$(COMPOSE) exec caddy caddy reload --config /etc/caddy/Caddyfile

rebuild: ## Rebuild the workspace image (picks up new CLI versions)
	$(COMPOSE) build --no-cache workspace
	$(COMPOSE) up -d workspace

logs: ## Tail logs from all services
	$(COMPOSE) logs -f --tail=100

ps: ## Show container status
	$(COMPOSE) ps

shell: ## Open a shell in the workspace container
	$(COMPOSE) exec workspace bash

shell-2: ## Open a shell in the second seat
	$(COMPOSE) exec workspace-2 bash

claude: ## Run the Claude Code CLI in the workspace
	$(COMPOSE) exec workspace claude

password: ## Generate a strong password for TOMSCODING_PASSWORD
	openssl rand -base64 24

backup: ## Snapshot every workspace home volume to ./backups
	mkdir -p backups
	$(COMPOSE) run --rm --no-deps --user root -v "$$PWD/backups:/backup" --entrypoint sh workspace \
	  -c 'tar czf /backup/home-$$(date +%Y%m%d-%H%M%S).tar.gz -C /home/coder .'
	@grep -q '^COMPOSE_PROFILES=.*seat2' .env 2>/dev/null \
	  && $(COMPOSE) run --rm --no-deps --user root -v "$$PWD/backups:/backup" --entrypoint sh workspace-2 \
	       -c 'tar czf /backup/home2-$$(date +%Y%m%d-%H%M%S).tar.gz -C /home/coder .' \
	  || true
	ls -lh backups | tail -n 5

whats-new: ## Tell the agent what changed, without a restart
	@# `make up` does this as part of a deploy. Run it on its own after a
	@# `git pull` when you want Sage current but have no reason to rebuild:
	@# the file is re-read on its next turn, so nothing needs restarting.
	sh scripts/whats-new.sh

check: ## Verify the sites resolve and the numbers page finishes drawing
	python3 scripts/check-sites.py
	@# A render that throws halfway leaves the page looking like one whose data
	@# never arrived, which sends the hunt to the server and the network before
	@# anybody suspects the page. This asks the page directly.
	node scripts/check-dashboard.mjs

doctor: ## Check the path between you and the VPS
	bash scripts/doctor.sh

privacy: ## Show what public records say about who runs these sites
	@# Reads .env for the domains, then asks public registries. Nothing is
	@# changed and nothing is sent anywhere — it is the same lookup a stranger
	@# would do, run by you, on you.
	python3 scripts/privacy-check.py
