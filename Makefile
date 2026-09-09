SHELL := /bin/bash
COMPOSE := docker compose

.DEFAULT_GOAL := help

.PHONY: cfm-setup cfm-offer cfm-offers hide show doors feed-quiet post-profile pair who admit waiting waiting-in waiting-back waiting-no waiting-rm featured feature feature-off post-improved post-numbers help up deploy down restart reload rebuild logs shell shell-2 claude ps backup check doctor privacy password fix-browser instructions partner-sync partner-sync-2 feed-sync partner-mockups whats-new feed-people feed-posts numbers-days app-check

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
	@# THE DOOR, CHECKED BEFORE EVERY DEPLOY.
	@# The board's "invite only" banner is a string in the page. The gate is
	@# this variable, and empty means there is no gate — the feed, the
	@# directory and every API are open to anybody with the address, while the
	@# page goes on saying otherwise. That is the one failure here nobody
	@# would see by looking at the site, so it is refused rather than warned
	@# about. Set it to "read" or, deliberately, to "open".
	@grep -q '^COMPOSE_PROFILES=.*board' .env && ! grep -qE '^TOMSCODING_BOARD_INVITE=(read|post|open)$$' .env \
	  && { echo "the board is enabled but TOMSCODING_BOARD_INVITE is not set."; \
	       echo "Empty means there is no door: everything is readable by anybody"; \
	       echo "with the address, while the page still says invite only."; \
	       echo "Set TOMSCODING_BOARD_INVITE=read in .env, or =open to mean it."; \
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

post-profile: ## Tell everybody how to finish their page, LinkedIn included
	@# Written after the first member made a page, went looking for LinkedIn,
	@# and could not find the box. The box moved; this reaches the people who
	@# already gave up looking. Idempotent — says nothing twice.
	@# AUTHOR, not AS. `AS` is one of make's own built-in variables — it names
	@# the assembler and is always set to "as" — so `$(if $(AS),...)` was
	@# always true and every one of these posted under the name "as". It went
	@# out on a live board before anybody noticed, because the failure looks
	@# exactly like a post from an account nobody recognises.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/post-profile.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  $(if $(AUTHOR),--as "$(AUTHOR)",) $(if $(AGAIN),--again,)

post-explainer: ## Put the how-to-be-the-same-person-twice post on the feed
	@# In both languages, because a board that explains itself in one of them
	@# has explained itself to half the people it is for. Idempotent: it looks
	@# for its own first line and does nothing if it is already up.
	@#
	@# Posts as The Professor by default;  make post-explainer AUTHOR="留学生"
	@# for another name.
	@# AUTHOR, not AS. `AS` is one of make's own built-in variables — it names
	@# the assembler and is always set to "as" — so `$(if $(AS),...)` was
	@# always true and every one of these posted under the name "as". It went
	@# out on a live board before anybody noticed, because the failure looks
	@# exactly like a post from an account nobody recognises.
	@grep -qE '^TOMSCODING_BOARD_KEY=.+' .env \
	  || { echo "TOMSCODING_BOARD_KEY is not set in .env — the board would refuse this."; exit 1; }
	$(COMPOSE) run --rm --no-deps -T \
	  -v "$(CURDIR)/scripts:/seed:ro" \
	  --entrypoint node board \
	  /seed/post-explainer.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  $(if $(AUTHOR),--as "$(AUTHOR)",) $(if $(AGAIN),--again,)

admit-existing: ## Let everybody already on the board through the door, once
	@# Run this BEFORE setting BOARD_INVITE=read, or the people already
	@# using it are shut out on the next deploy.
	@# node, not wget: the board image has no wget in it, and the first run of
	@# this printed "wget: not found" before the fallback answered.
	$(COMPOSE) exec -T board node -e "fetch('http://127.0.0.1:8080/api/admit-existing',\
	  {method:'POST',headers:{'x-admin-secret':process.env.BOARD_ADMIN_KEY}})\
	  .then(r=>r.json()).then(d=>console.log(JSON.stringify(d)))"

post-door: ## Tell the feed the board is private now, as The Professor
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/post-door.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" $(if $(AGAIN),--again,)

invite: ## Make an invite:  make invite WHO="you" FOR="them" [N=3]
	@# Prints the link and the code as the message to send. One person each.
	@#
	@# WHO is whoever is vouching — it is the label on the row and the name the
	@# door says on the way in ("Tom let you in"), so it is usually you.
	@# FOR is the person receiving it. It goes in the link and nowhere else:
	@# the door opens with their name on it and nothing is stored about them.
	@# Neither name opens anything. The six characters still do that.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/invite.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --who "$(WHO)" $(if $(FOR),--for "$(FOR)",) --n "$(or $(N),1)"

post-numbers: ## Say where the whole board has got to, as The Professor
	@# Safe every morning: it works out what the totals were when it last spoke
	@# and says nothing if they have not moved. DRY=1 to see what it would say.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/post-numbers.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  $(if $(DRY),--dry,) $(if $(AGAIN),--again,)

post-improved: ## Name one person whose level moved this week, as The Professor
	@# Weekly. Names nobody if nobody moved, and says nothing twice in one week,
	@# so it is safe on a cron. DRY=1 to see who it would name.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/post-improved.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  $(if $(DRY),--dry,) $(if $(AGAIN),--again,)

hide: ## Take somebody out of Browse:  make hide WHO="their name"
	@# Reversible, silent, and nothing is deleted — see person-out.mjs.
	@test -n "$(WHO)" || { echo 'which one? make hide WHO="their name"'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/person-out.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" --who "$(WHO)"

show: ## Put them back:  make show WHO="their name"
	@test -n "$(WHO)" || { echo 'which one? make show WHO="their name"'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/person-out.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" --who "$(WHO)" --back

doors: ## Did anybody come off that link:  make doors [DAYS=30]
	@# Three numbers a day per room — opened, began the form, joined — and
	@# nothing else. No addresses and no devices, so there is nothing here
	@# that could say who came. It tells you which of three things went
	@# wrong: the post did not travel, the door did not convince them, or
	@# the form lost them.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/doors.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" $(DAYS)

waiting: ## Who is waiting outside, and let them in or not
	@# make waiting-in ID=... to mark somebody let in, then make invite for a code.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/waiting.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)"

pitch: ## WeChat copy for each door:  make pitch  |  make pitch ROOM=film
	@# The link that works is not the obvious one — see the note in pitch.mjs.
	@#
	@# Through the board container like every other target here. This one used
	@# to run node on the host, on the grounds that it talks to nothing and
	@# only prints — and the box has no node on it, so it printed
	@# "node: command not found" instead. Nothing needs installing on a server
	@# whose whole job is to run containers.
	@# The address people actually type, read off .env rather than written in
	@# here — the domain has moved once already and a link in a pitch that goes
	@# to the old one is worse than no pitch.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/pitch.mjs "https://$$(grep -E '^TOMSCODING_BOARD_DOMAIN=' .env | tail -1 | cut -d= -f2- | tr -d '\"')" "$(ROOM)"

admit: ## Let a whole room in at once:  make admit ROOM=film
	@# Cold start is the only real risk in a room-based board. One name at a
	@# time and each person arrives to an empty feed; a room together and it
	@# is warm the morning they get there. Prints a code per person to send.
	@test -n "$(ROOM)" || { echo 'which room? make admit ROOM=film|invest|raise|other'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/waiting.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --admit "$(ROOM)" --max "$(MAX)" \
	  --public "https://$$(grep -E '^TOMSCODING_BOARD_DOMAIN=' .env | tail -1 | cut -d= -f2- | tr -d '\"')"

wait-add: ## Write it down:  make wait-add NAME="Wei" REACH="wechat weilin88" ROOM=film
	@# For somebody who asked in a WeChat thread or in person. Every row is
	@# still a real ask — the public page says how many are waiting and that
	@# number has to be true.
	@test -n "$(NAME)" -a -n "$(REACH)" || { echo 'both: make wait-add NAME="Wei" REACH="wechat weilin88" [WHY="..."]'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/waiting.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --name "$(NAME)" --reach "$(REACH)" --why "$(WHY)" --room "$(ROOM)"

waiting-in: ## Mark one as let in: make waiting-in ID=...
	@test -n "$(ID)" || { echo "which one? make waiting-in ID=..."; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/waiting.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" --in "$(ID)"

# The ledger runs inside the estate; reached by service name, so the admin key
# never leaves this box to make an offer.
define cfm
$(COMPOSE) run --rm --no-deps -T -e K="$$(grep -E '^TOMSCODING_CFM_KEY=' .env | tail -1 | cut -d= -f2-)" \
  --entrypoint node cfm -e '(async () => { \
  const [, , url, method, body] = process.argv; \
  const r = await fetch("http://cfm:3000" + url, { method, \
    headers: { "content-type": "application/json", "x-admin-secret": process.env.K }, \
    body: body || undefined }); \
  process.stdout.write(await r.text()); \
  if (!r.ok) process.exit(1); })()' $(2) $(1) $(3)
endef

cfm-setup: ## Create the project and the two packages: make cfm-setup
	@# Once, on a new box. The ledger knows nothing about The Exchange until it
	@# is told — a name, a line and where to send somebody who accepts. See
	@# cfm/lib/store.js for why that is the whole of it.
	@$(call cfm,POST,/api/project,'{"id":"the-exchange","name":"The Exchange","zh":"交换","line":"The people you need in China already know each other. This is the room.","goTo":"https://liuxuesheng.io/enter","seats":100}')
	@$(call cfm,POST,/api/package,'{"id":"founding","name":"Founding","project":"the-exchange","face":"plain","points":500,"perDay":3}')
	@$(call cfm,POST,/api/package,'{"id":"connector","name":"Connector","project":"the-exchange","face":"reach","points":200,"perDay":10}')
	@echo "the-exchange · founding · connector"

cfm-offer: ## One offer to one person: make cfm-offer WHO="Keith" [PACK=founding SEAT=3 NOTE="..."]
	@# The seat is decided here, not when it is opened. Two people quietly told
	@# they are third is the one mistake here that cannot be walked back.
	@test -n "$(WHO)" || { echo 'which one? make cfm-offer WHO="their name"'; exit 1; }
	@$(call cfm,POST,/api/offer,'{"who":"$(WHO)","project":"the-exchange","package":"$(or $(PACK),founding)","seat":$(or $(SEAT),0),"note":"$(NOTE)","until":"$(UNTIL)"}') \
	  | python3 -c 'import json,sys; o=json.load(sys.stdin)["offer"]; print("\n  " + o["who"] + " · seat " + str(o["seat"]) + "\n\n      " + o["code"] + "\n")'

cfm-offers: ## Who has been offered what, and who opened it
	@$(call cfm,GET,/api/offers,) | python3 -c 'import json,sys;\
	  rows=json.load(sys.stdin)["offers"];\
	  print();\
	  [print("  %-14s %-8s seat %-4s %-10s %s" % (r["who"], r["code"], r["seat"], r["package"], "accepted" if r["tookAt"] else ("opened" if r["openedAt"] else "not opened"))) for r in rows];\
	  print()'

waiting-key: ## A code that gives one person their place back: make waiting-key ID=...
	@# For somebody whose browser forgot them — a cleared cache, a new phone, a
	@# private window. Rows are found by device hash and nothing else, so
	@# without this they cannot be reunited with their own card, and filling the
	@# form again writes a second row instead of finding the first. They type it
	@# at the same box a member uses. It does not let anybody in: it hands back
	@# a place on the list and the card they filled in. Asking again mints a
	@# fresh one and the old one stops working.
	@test -n "$(ID)" || { echo "which one? make waiting-key ID=..."; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/waiting.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" --key "$(ID)"

waiting-back: ## Put one back on the list: make waiting-back ID=...
	@# Undoes an admit. The code minted for them is a separate thing and keeps
	@# working until it is taken back:  make invite-off CODE=...
	@test -n "$(ID)" || { echo "which one? make waiting-back ID=..."; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/waiting.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" --back "$(ID)"

waiting-no: ## Turn one down: make waiting-no ID=...
	@test -n "$(ID)" || { echo "which one? make waiting-no ID=..."; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/waiting.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" --no "$(ID)"

waiting-rm: ## Delete a row outright: make waiting-rm ID=...
	@test -n "$(ID)" || { echo "which one? make waiting-rm ID=..."; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/waiting.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" --rm "$(ID)"

featured: ## What is on the public page, and what you could put there
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/feature.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" --list

feature: ## Show one post outside the door: make feature ID=... [ASKED=1]
	@test -n "$(ID)" || { echo "which one? make featured   to see the list"; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/feature.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --id "$(ID)" $(if $(ASKED),--asked,)

feature-off: ## Take the featured post down
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/feature.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" --off

who: ## Who has a page, and who is actually in Browse
	@# For "she added herself but I cannot see her". The public list holds only
	@# the people who ARE in Browse, so the answer to that question was never in
	@# it — this reads the admin route and says which switch is off.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/who.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)"

standing: ## Who can bring somebody in, and who cannot yet
	@# The companion to `who`. A rule nobody can see the effect of is a rule
	@# that gets argued about instead of read — this says, per member, whether
	@# they have a code today and every test they are failing.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/standing.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)"

pair: ## Why two people cannot talk yet — make pair A="Tom" B="Hugo"
	@# A match is three tests and somebody can pass two of them and see
	@# nothing. There is no screen that says which one failed, and there
	@# should not be — it would be a screen about somebody else's settings.
	@# This says which, and whose it is to fix.
	@test -n "$(A)" && test -n "$(B)" || { echo 'Two names:  make pair A="Tom" B="Hugo"'; exit 2; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/pair.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --a "$(A)" --b "$(B)"

invites: ## Every invite, and what became of it
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/invite.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" --list

invite-off: ## Take one back:  make invite-off CODE=K7M2QP
	@test -n "$(CODE)" || { echo "which one? make invite-off CODE=K7M2QP"; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/invite.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" --off "$(CODE)"

feed-list: ## What is on the feed, with ids
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/feed-remove.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)"

feed-quiet: ## Clear the house off the feed:  make feed-quiet [WHO=name] GO=1
	@# Four Professor posts on a board of fifteen makes the house the loudest
	@# member. Everything they said is answered permanently in Ask the
	@# Professor, which does not take a slot. Prints what it would do; GO=1
	@# does it. Nothing is deleted — rows stay with a reason on them.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/feed-quiet.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  $(if $(WHO),--who "$(WHO)",) $(if $(GO),--go,)

feed-remove: ## Take one post off the feed:  make feed-remove ID=<id>
	@# Marks it removed, the same as the panel's button. The row stays in the
	@# file with a reason on it; readers stop seeing it. Nothing deletes.
	@test -n "$(ID)" || { echo "ID= is required. Run  make feed-list  first."; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/feed-remove.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --id "$(ID)" $(if $(WHY),--why "$(WHY)",)

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
