SHELL := /bin/bash
COMPOSE := docker compose

.DEFAULT_GOAL := help

.PHONY: try try-china china app-state claire-episodes deal claire-key claire-count claire-seed claire-video listing invite-each mo mo-say handroom back mail ferry-keys waiting-rooms gram gram-clips gram-next gram-token gram-list gram-post demo demo-cards demo-rm cfm-project can-offer offer offers announcer announcements save restore why-no-row room-keep cfm-setup cfm-self cfm-owner cfm-owners cfm-grantor cfm-stake cfm-offer cfm-seal cfm-seals cfm-keypair cfm-anchoring cfm-anchor cfm-verify cfm-unseal cfm-reopen cfm-void cfm-offers hide show doors feed-quiet post-profile pair match who bells twice admit groups group-invite flags waiting waiting-in waiting-back waiting-no waiting-rm featured feature feature-off peeks peek peek-off tell-rooms post-improved post-numbers help up deploy down restart reload rebuild logs shell shell-2 claude ps backup check doctor privacy password fix-browser instructions partner-sync partner-sync-2 feed-sync partner-mockups whats-new feed-people feed-posts numbers-days app-check post post-status post-run post-login post-code post-logins weidian-pull weidian-json weidian-reviews shop-chapter

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
	@#
	@# THIS .env, NOT A PRESET. It was a hand-written comparison of the board
	@# against the brand, which is the one collision that had already happened —
	@# and the next move is the board onto the site's hostname, which it would
	@# have gone straight past. check-sites.py resolves every site block the way
	@# Caddy does and knows about empties and variables the caddy service is
	@# never passed, which no grep here was ever going to. It was only ever run
	@# against two synthetic presets; the file that can be wrong tonight is this
	@# one.
	@python3 scripts/check-sites.py .env
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
	@# A COPY BEFORE EVERY DEPLOY, and this is the whole reason `save` exists.
	@# The one thing on this box that has actually gone wrong is code that runs
	@# at boot and rewrites rows — a migration republished every held profile
	@# on every restart and undid the same afternoon's work three times before
	@# anybody could see what was doing it. The deploy is the moment that risk
	@# arrives, so the copy is taken here, first.
	@#
	@# Never fatal. A box with no backups directory, or a volume that is not
	@# there yet on a fresh install, must not stop a deploy — it says so and
	@# carries on.
	@$(MAKE) save || echo "note: could not copy the data first — deploying anyway"
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
	@# AND WHETHER THE LEDGER OWES A SEAL. Every offer page tells the person
	@# signing it that their record is hashed and anchored. That is only true
	@# if somebody runs the seal once a month has ended, and nothing else on
	@# this box would ever mention it. Quiet when nothing is owed, never fatal.
	@grep -q "^COMPOSE_PROFILES=.*cfm" .env 2>/dev/null && $(MAKE) --no-print-directory cfm-due || true
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

can-offer: ## Who may make offers, or let one:  make can-offer [WHO=Mia] [ID=... OFF=1]
	@# Deliberately one person at a time and never derived from somebody's role.
	@# Reaching a stranger with money attached is a different power from being
	@# in the room, and an agent nobody has vouched for should not get it by
	@# ticking a box on the way in. It becomes part of a matched card later.
	@$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/offer.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  can-offer --who "$(WHO)" $(if $(ID),--id "$(ID)",) $(if $(OFF),--off,)

announcer: ## Who may write an announcement, or let one:  make announcer [WHO=Tom] [ID=... OFF=1]
	@# An announcement is a page on the open internet with this board's name on
	@# it, carrying a photograph and a claim about a named person. A member who
	@# could publish one unreviewed could publish anything, to anybody, and the
	@# first anybody here would know of it is a screenshot. So: one person at a
	@# time, the same as can-offer above.
	@$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/announce.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  can-announce $(if $(WHO),--who "$(WHO)",) $(if $(ID),--id "$(ID)",) $(if $(OFF),--off,)

# The ElevenLabs key, pulled the same way every other target here pulls one.
#
# NOT `. ./.env`. Sourcing it as shell ran `Feed: command not found` on line 56
# and died on line 97 — TOMSCODING_BOARD_MAIL_FROM=The Exchange <onboarding@...>
# is a perfectly good env line and an invalid shell one. grep and cut read the
# file as what it is.
XI_KEY = $$(grep -E '^ELEVENLABS_API_KEY=' .env | tail -1 | cut -d= -f2-)
XI_VOICE = $$(grep -E '^ELEVENLABS_VOICE_ID=' .env | tail -1 | cut -d= -f2-)
# One voice each, if .env names them. Unset, both fall back to XI_VOICE and it
# is one person in both languages — see the note in scripts/voice.mjs.
XI_VOICE_EN = $$(grep -E '^ELEVENLABS_VOICE_ID_EN=' .env | tail -1 | cut -d= -f2-)
XI_VOICE_ZH = $$(grep -E '^ELEVENLABS_VOICE_ID_ZH=' .env | tail -1 | cut -d= -f2-)

voices: ## Which voices the ElevenLabs account has, to pick one
	@# The voice IS the first impression. Listen to a few on elevenlabs.io,
	@# then put the id in .env as ELEVENLABS_VOICE_ID before running `make
	@# voice` — the default is a stock preset and picking it by default is not
	@# the same as choosing it.
	@# In the container, like every other script target: there is no node on
	@# the box. `make voices` on the host was 127, command not found.
	@$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" \
	  -e ELEVENLABS_API_KEY="$(XI_KEY)" -e BOARD_PUBLIC=/app/public \
	  --entrypoint node board /seed/voice.mjs --list

voice: ## Render the arrival's four beats, both languages:  make voice [FORCE=1]
	@# ONCE, NOT PER VISIT. The beats carry no name and no number — see the
	@# note on wel.b1Up in i18n.js — so the audio is a constant and belongs in
	@# the repository beside the string it speaks. The box never holds a TTS
	@# key at runtime, the arrival never waits on an API, and a visit costs
	@# nothing.
	@#
	@# --user 0:0 and a bind mount, which is the pair that makes this work. The
	@# board runs as 1000 and writes only to its volume; this has to write into
	@# the checkout, and a bind mount Docker creates is owned by root. It is an
	@# admin task run by hand, not a serving path.
	@mkdir -p board/public/voice
	@$(COMPOSE) run --rm --no-deps -T --user 0:0 \
	  -v "$(CURDIR)/scripts:/seed:ro" -v "$(CURDIR)/board/public/voice:/out" \
	  -e ELEVENLABS_API_KEY="$(XI_KEY)" -e ELEVENLABS_VOICE_ID="$(XI_VOICE)" \
	  -e ELEVENLABS_VOICE_ID_EN="$(XI_VOICE_EN)" -e ELEVENLABS_VOICE_ID_ZH="$(XI_VOICE_ZH)" \
	  -e BOARD_PUBLIC=/app/public -e VOICE_OUT=/out \
	  --entrypoint node board /seed/voice.mjs $(if $(FORCE),--force,)
	@echo
	@echo "  The files are part of the product — commit them, or the next"
	@echo "  git reset --hard on this box throws them away:"
	@echo
	@echo "    git add board/public/voice && git commit -m 'The arrival voice' && git push"
	@echo

announcements: ## Every poster, its link, and whether it brought anybody
	@$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/announce.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  list

offer: ## Send somebody real work:  make offer FROM=Tom WHO="Yana" GIVE="..." [PAYS="¥8,000" WANT="..." PROJECT=1]
	@# Prints the one link to paste into WeChat. It opens for anybody — no code,
	@# no account, not a member — and accepting it is what lets them in.
	@#
	@# FROM is the member it comes from and must be a handle with a published
	@# page: an offer from nobody is not a thing anybody should be able to make.
	@# WHO is a note to yourself so `make offers` reads as names; the person
	@# opening it never sees it.
	@#
	@# PROJECT=1 sends it as a project rather than a job: PAYS may be left out,
	@# the page says the money is not settled instead of hiding the line, and
	@# accepting it opens a few lines to settle it in.
	@test -n "$(FROM)" -a -n "$(GIVE)" || { \
	  echo 'make offer FROM=Tom WHO="Yana" GIVE="what they would do" PAYS="¥8,000" WANT="what you expect"'; exit 1; }
	@$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/offer.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  send --from "$(FROM)" --who "$(WHO)" --give "$(GIVE)" \
	  $(if $(PROJECT),--project,) --pays "$(PAYS)" --want "$(WANT)" \
	  --public "https://$$(grep -E '^TOMSCODING_BOARD_DOMAIN=' .env | tail -1 | cut -d= -f2- | tr -d '"')"

offers: ## Every offer, and who took it
	@$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/offer.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  list

invite: ## Make an invite:  make invite WHO="you" FOR="them" [HOURS=48] [N=3]
	@# Prints the message to send, between two rules. One person each.
	@#
	@# WHO is whoever is vouching — it is the label on the row and the name the
	@# door says on the way in ("Tom let you in"), so it is usually you.
	@# FOR is the person receiving it. It goes in the link and nowhere else:
	@# the door opens with their name on it and nothing is stored about them.
	@# Neither name opens anything. The six characters still do that.
	@#
	@# HOURS is how long it lasts and the default is 48. It was 24, on the
	@# reasoning that a day is long enough to see a message, sleep on it and
	@# still get in. In practice these go out as an Instagram or WeChat DM on a
	@# Sunday afternoon to somebody who is not at their desk, reads it that
	@# evening, and opens it properly on Tuesday. A dead code is not a small
	@# failure: it is a person who decided to come in and was turned away, and
	@# the second invite never feels like the first one.
	@# Forty-eight is still short enough that a code forwarded into a group chat
	@# next week opens nothing, which is the whole point of there being a clock.
	@# It also matches agent-invite, which has defaulted to 48 since the day it
	@# was written, for the same reason and with better evidence.
	@# HOURS=72 over a weekend; HOURS=0 for one that never stops, which is right
	@# for a code you carry around and hand out in person.
	@#
	@# The deadline travels in the link and the door counts it down on screen.
	@# The code itself never travels in a link — see enter.html.
	@# The address in the link, read off .env the way offer and pitch already
	@# read it. Without this the script fell back to a name written into it,
	@# which stayed the old one through the move — every code minted printed a
	@# liuxuesheng.io link. The redirect caught them, but the name in the
	@# message is the first thing the person you are inviting sees.
	$(COMPOSE) run --rm --no-deps -T \
	  -e BOARD_PUBLIC_URL="https://$$(grep -E '^TOMSCODING_BOARD_DOMAIN=' .env | tail -1 | cut -d= -f2- | tr -d '\"')" \
	  -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/invite.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --who "$(WHO)" $(if $(FOR),--for "$(FOR)",) --hours "$(if $(HOURS),$(HOURS),48)" --n "$(or $(N),1)"

invite-each: ## Thirty at once:  make invite-each WHO="Tom" NAMES="Ray,Ian,Mei" [HOURS=48]
	@# ONE COMMAND, ONE BLOCK PER PERSON, AND THE INVITE ITSELF UNTOUCHED.
	@#
	@# `make invite` mints one. N=3 mints three for the SAME person, which is
	@# not what a night of inviting thirty people looks like — that is thirty
	@# commands, each waiting on a container, at midnight, and the failure mode
	@# is a name typed into the wrong one.
	@#
	@# So this loops. It does not change invite.mjs by a character: the invite
	@# is settled — the block between two rules, the link and the code on
	@# separate lines, the named greeting, the clock, one person once — and a
	@# batch is not a reason to reopen any of it. The loop is out here, one
	@# container for the lot of them, calling the same script once per name.
	@#
	@# NAMES is comma separated because a name has a space in it more often
	@# than it has a comma. Spaces around each one are trimmed.
	@#
	@# WHO is still whoever is vouching, and it is the same for all of them:
	@# these are thirty people YOU are bringing in, so the door says your name
	@# thirty times, which is the truth.
	@#
	@# Output is thirty blocks, each between two rules, in the order given.
	@# Scroll back and paste them one at a time — and check the name at the top
	@# of each before you send it, because the only thing worse than no invite
	@# is one addressed to somebody else.
	@test -n "$(NAMES)" || { echo ""; echo '  NAMES is empty. make invite-each WHO="Tom" NAMES="Ray,Ian,Mei"'; echo ""; exit 2; }
	@test -n "$(WHO)" || { echo ""; echo '  WHO is empty — it is the name the door says out loud. Usually you.'; echo ""; exit 2; }
	$(COMPOSE) run --rm --no-deps -T \
	  -e BOARD_PUBLIC_URL="https://$$(grep -E '^TOMSCODING_BOARD_DOMAIN=' .env | tail -1 | cut -d= -f2- | tr -d '\"')" \
	  -e INV_KEY="$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  -e INV_WHO="$(WHO)" -e INV_NAMES="$(NAMES)" -e INV_HOURS="$(if $(HOURS),$(HOURS),48)" \
	  -v "$(CURDIR)/scripts:/seed:ro" --entrypoint sh board -c '\
	    printf "%s" "$$INV_NAMES" | tr "," "\n" | while IFS= read -r one; do \
	      one=$$(printf "%s" "$$one" | sed "s/^[[:space:]]*//;s/[[:space:]]*$$//"); \
	      [ -z "$$one" ] && continue; \
	      node /seed/invite.mjs http://board:8080 "$$INV_KEY" \
	        --who "$$INV_WHO" --for "$$one" --hours "$$INV_HOURS" --n 1 || exit 1; \
	    done'

groups: ## The rooms and their ids:  make groups
	@# Only so a group invite can be minted. Names and counts, never a word
	@# anybody said in one — see the note at the top of groups.mjs.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/groups.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)"

flags: ## Lines somebody said should be looked at:  make flags
	@# The one way a word said inside a room is read from outside it. A line is
	@# here because a person in that room reported it, or because the doorman's
	@# tripwire marked it — see screen() in board/lib/store.js.
	@#
	@# There is no command that prints a room's conversation, and there should
	@# not be. Everything here is in a file on this box in plain text and the
	@# product has never said otherwise; a file opened for a reason is a
	@# different thing from a screen that shows somebody conversations, and the
	@# second one would have to go on the privacy page.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/flags.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)"

group-invite: ## Into one conversation:  make group-invite WITH="Damon Russell" WHO="Tom" FOR="Ava" [NAME="Talk film"]
	@# The same door as `make invite` and the same message shape — it is settled
	@# and this does not redesign it. Two things differ.
	@#
	@# The message says what the code opens into and who is already in there,
	@# before the link, because that is the reason to open the link. "Here is
	@# your way in" is the wrong sentence for a code that lands somebody in a
	@# conversation between three named people.
	@#
	@# And the door puts them in that room rather than on Browse — reading it,
	@# with the composer replaced by a name and one sentence. They can read
	@# every word before they give anything, which is the opposite way round
	@# from a blank profile form, and they can leave at any point.
	@#
	@# TWO WAYS TO SAY WHICH ROOM.
	@#
	@# GROUP=<id from `make groups`> puts them into one that already exists.
	@#
	@# WITH="Damon Russell" makes the room as it mints the code, which is the
	@# case this was built for and the one that could not be reached: making a
	@# room takes three people who are already members, and the third is the
	@# person you are bringing in. The code holds the last seat. Comma-separate
	@# for more than one, and NAME= gives it a name.
	@#
	@# WHO is the name on YOUR OWN PROFILE when WITH is used, not a free label
	@# — somebody owns a room, and it is their matches the membership is drawn
	@# from. `make who` if you are not sure what it says.
	@#
	@# A room holds five, and somebody holding an unspent code for it is
	@# already sitting in one of the seats.
	@test -n "$(GROUP)$(WITH)" || { echo 'which room? GROUP=<id from make groups>, or WITH="their name" to make one'; exit 1; }
	@test -n "$(WHO)" || { echo 'who is vouching? make group-invite WITH="Damon Russell" WHO="Tom" FOR="Ava"'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T \
	  -e BOARD_PUBLIC_URL="https://$$(grep -E '^TOMSCODING_BOARD_DOMAIN=' .env | tail -1 | cut -d= -f2- | tr -d '\"')" \
	  -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/invite.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --who "$(WHO)" $(if $(FOR),--for "$(FOR)",) --hours "$(if $(HOURS),$(HOURS),48)" --n "$(or $(N),1)" \
	  --group "$(GROUP)" --with "$(WITH)" --name "$(NAME)"

agent-invite: ## Bring an agent in:  make agent-invite WHO="Tom" FOR="Andy" [HOURS=48]
	@# The same door as `make invite` and the same message shape — it is settled
	@# and this does not redesign it. Two things differ.
	@#
	@# The message answers the objection an agent has before they open anything:
	@# they are not handing over their list. Everybody they represent gets their
	@# own page, they run all of them from one login, and a producer who wants
	@# one of them is talking to THEM. Said in the message because that is where
	@# it is read, not on a page they may never reach.
	@#
	@# And the door lands them on /onboard instead of Browse. An agent's first
	@# job is not to look at anybody, it is to get nine people up — forty
	@# minutes of typing, or one drag of a folder on a laptop. Sending somebody
	@# with that ahead of them to a deck of strangers is how they never come
	@# back. The row is made on the way in with the sentence already set; the
	@# console asks their name and nothing else.
	@#
	@# HOURS defaults to 48 rather than 24: this one usually needs a laptop, and
	@# somebody reading it on a phone on a Friday should still have it on Monday.
	$(COMPOSE) run --rm --no-deps -T \
	  -e BOARD_PUBLIC_URL="https://$$(grep -E '^TOMSCODING_BOARD_DOMAIN=' .env | tail -1 | cut -d= -f2- | tr -d '"')" \
	  -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/invite.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --who "$(WHO)" $(if $(FOR),--for "$(FOR)",) --hours "$(if $(HOURS),$(HOURS),48)" --n "$(or $(N),1)" --agent

mail: ## Put an email on somebody's row so they can sign in:  make mail WHO="Tom" ADDR="tom@x.com"
	@# The address is what a sign-in code gets sent to. It has to be ON their
	@# row, and the only way to put it there was to be signed in already —
	@# which is fine for everybody except the person locked out, who is the
	@# one who needs it. This writes it from here, so nobody has to find a
	@# key, save a key, or type a key.
	@#
	@# It is not a way in. An address opens nothing on its own: the six digits
	@# still have to be typed on the browser that wants to be them.
	@#
	@# ADDR="" takes it off again.
	@#
	@# Needs mail switched on: TOMSCODING_BOARD_MAIL_KEY and _MAIL_FROM in
	@# .env, or the door says so rather than sending nothing.
	@test -n "$(WHO)" || { echo 'make mail WHO="their name" ADDR="them@example.com"'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/mail.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --who "$(WHO)" --mail "$(ADDR)"

board-keys: ## Make the keypair the board needs to buzz a phone: make board-keys
	@# Prints three lines for .env. ONCE — a new pair does not rotate a secret,
	@# it orphans every subscription: a browser subscribed under the old public
	@# key cannot be reached by a token signed with the new one, and its row
	@# sits in the file looking alive. Everybody who turned this on silently
	@# stops being told, and the only fix is asking each of them again.
	@# RUN INSIDE THE BOARD'S OWN CONTAINER, like every other script target
	@# here. The first version of this called `node` on the host, and the host
	@# has no node — nothing on this box does, which is the whole point of it
	@# being containers. `node: command not found`, from a target whose entire
	@# job is to print two strings.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" \
	  --entrypoint node board /seed/board-keys.mjs

ferry-keys: ## Make the keypair Ferry needs to send notifications
	@# VAPID: the standard that lets a server push to Apple's and Google's
	@# services without an account with either. Two keys, made once, and the
	@# private half never leaves .env.
	@#
	@# Notifications are off until these are set, and the page does not ask
	@# anybody for permission on a box that cannot send — a permission prompt
	@# is a thing you get to show once, and a dismissal is permanent.
	@#
	@# Paste the two lines it prints into .env, then `make deploy`.
	$(COMPOSE) run --rm --no-deps -T --entrypoint node ferry \
	  -e "const w=require('web-push');const k=w.generateVAPIDKeys();\
	      console.log('TOMSCODING_FERRY_VAPID_PUBLIC='+k.publicKey);\
	      console.log('TOMSCODING_FERRY_VAPID_PRIVATE='+k.privateKey);"

back: ## Somebody locked out of their own page: make back WHO="Tom" [TO=dealio]
	@# For a member who has lost their key and cannot be reached by email —
	@# a new phone, cleared storage, or the night the domain moved and every
	@# browser on the old one became a stranger.
	@#
	@# WHO is their name as it appears on the board. It prints a message to
	@# send them: the door, and six characters. Typing them moves their page,
	@# their follows and their cards onto whatever browser is in front of them.
	@#
	@# It opens nothing new — there is no new person at the end of it — and it
	@# is spent the moment it is used. A second one for the same person
	@# replaces the first, so a code sent last week stops working tonight.
	@#
	@# TO IS WHERE IT LANDS THEM: make back WHO="Tom" TO=dealio. Without it
	@# the door drops everybody on the board, which is right for somebody who
	@# lost their phone and wrong for everybody else — a way-back code is
	@# almost always minted for somebody standing in front of one particular
	@# screen, and "now go and find Dealio again" is a second step.
	@test -n "$(WHO)" || { echo 'make back WHO="their name"'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T \
	  -e BOARD_PUBLIC_URL="https://$$(grep -E '^TOMSCODING_BOARD_DOMAIN=' .env | tail -1 | cut -d= -f2- | tr -d '\"')" \
	  -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/back.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --who "$(WHO)" --to "$(TO)"

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

snap: ## The link for your phone — what happened since yesterday: make snap
	@# One address to save to a home screen and open in WeChat. Read-only, and
	@# its own secret rather than the admin key: a URL lives in browser history
	@# and in whatever it gets pasted into, and the admin key opens every route
	@# on this box.
	@#
	@# Off until BOARD_SNAP is in .env. With nothing there this prints a line
	@# to paste and the deploy that switches it on.
	@printf '\n'
	@if grep -qE '^TOMSCODING_BOARD_SNAP=.+' .env; then \
	  echo "  Your link — save it to your home screen:"; \
	  echo ""; \
	  echo "    https://$$(grep -E '^TOMSCODING_BOARD_DOMAIN=' .env | tail -1 | cut -d= -f2- | tr -d '\"')/s/$$(grep -E '^TOMSCODING_BOARD_SNAP=' .env | tail -1 | cut -d= -f2-)"; \
	  echo ""; \
	  echo "  The board's own domain, not the workspace's — this printed a"; \
	  echo "  code.tomscoding.com address once, which serves a different app."; \
	  echo ""; \
	  echo "  Anybody with it can read it, so it goes nowhere but your phone."; \
	  echo "  To revoke: change that line in .env and make deploy."; \
	else \
	  echo "  No link yet. Put this line in .env:"; \
	  echo ""; \
	  echo "    TOMSCODING_BOARD_SNAP=$$(head -c 18 /dev/urandom | od -An -tx1 | tr -d ' \n')"; \
	  echo ""; \
	  echo "  Then:  make deploy && make snap"; \
	fi
	@printf '\n'

handroom: ## A room you keep by hand: make handroom [WHO="Ray Chen"] [OFF=1] [NAME="..."]
	@# For a room where being in it depends on something this board cannot see —
	@# an offer on the cfm ledger, say. Nobody joins it, nobody is invited into
	@# it, there is no link, and the app refuses Add somebody and Take out on
	@# it. You are the list. They have to be a member first: see `make card`.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/handroom.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --name "$(NAME)" --who "$(WHO)" $(if $(OFF),--off,)

door-in: ## Door opens with a button instead of a code: make door-in [OFF=1]
	@# The landing page stays exactly as it is. What goes is the six boxes —
	@# the part that kept breaking: typed wrong, spent, landed on the wrong
	@# page, or simply six characters read off a screen.
	@#
	@# WHILE IT IS ON, ANYBODY WHO OPENS THE DOOR CAN TAP IT and be whoever
	@# the standing code names. Not guess a code — tap a button. It is for
	@# showing somebody the product, not for leaving on.
	@#
	@# Needs make sign-in-code first, so it cannot be switched on by accident
	@# on a box that never had a standing code.
	@bash scripts/door-in.sh

payout: ## The link that sets where somebody's money lands: make payout WHO="Tom"
	@# Setting up payouts is the one thing a payee does themselves — the app
	@# gives them a button and Stripe takes the bank details on its own pages.
	@# This mints the same link from here.
	@#
	@# WHY AN OPERATOR NEEDS IT. make go-live clears every payout account on
	@# the board, because an account minted under a test key does not exist
	@# under a live one. The first person it clears is whoever is testing, who
	@# then has a real request on a real phone saying "has not said where the
	@# money should land" and a button three taps into a page he has to find.
	@#
	@# One use, and it expires. Run it again rather than keeping one. Nothing
	@# secret is printed — not the account id, and never a bank number.
	@test -n "$(WHO)" || { echo 'make payout WHO="their name"'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T \
	  -e BOARD_PUBLIC_URL="https://$$(grep -E '^TOMSCODING_BOARD_DOMAIN=' .env | tail -1 | cut -d= -f2- | tr -d '\"')" \
	  -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/payout.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --who "$(WHO)"

payee: ## Where somebody's money goes: make payee WHO="Claire" ACCT=acct_… [OFF=1]
	@# A payee normally sets this themselves — the room gives them a button and
	@# Stripe takes their bank and identity on its own pages. This is for the
	@# other end of a test: a sandbox payee onboarded from a terminal has an
	@# account id and nobody to put it on, and until a row carries it the
	@# payment path cannot be walked once.
	@#
	@# AN ACCOUNT ID AND NOTHING ELSE. Stripe's own identifier, useless to
	@# anybody who is not this platform. Never a bank number.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/payee.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --who "$(WHO)" --acct "$(ACCT)" $(if $(OFF),--off,)

hear: ## What it makes of what somebody said: make hear TEXT="twelve lessons at 200, Tuesdays at seven"
	@# THE HARD HALF OF THE VOICE STEP, WITHOUT A MICROPHONE. What can be wrong
	@# is the reading, not the recording — and the reading is the part that
	@# would quietly write a number nobody said. Type the sentence and see what
	@# it understood, including the question it would ask back.
	@#
	@# It creates nothing. Nothing is ever written from a guess: the person who
	@# spoke reads the sentence back and confirms it first.
	@test -n "$(TEXT)" || { echo 'make hear TEXT="what they said"'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/hear.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --said "$(TEXT)"

ask: ## A payment request, and its link: make ask WHO="Claire" AMOUNT="¥1" [FOR="a test"] [TRY=1]
	@# TO TEST THE PAYING HALF WITHOUT SIGNING ANYTHING IN. The person paying
	@# needs no account — that is the design — but the person asking does, and
	@# putting an identity on a particular phone is a sign-in and a code typed
	@# by hand. For a one-yuan test that is three steps too many.
	@#
	@# WHO is a first name: whoever is asking for the money, as they appear on
	@# the board. It prints one address. Open it on any phone.
	@#
	@# TRY=1 also asks Stripe to open a checkout in each of the three methods
	@# and prints opens or REFUSED with the reason — without anybody copying a
	@# twenty-character id out of a terminal into a second command.
	@test -n "$(WHO)" || { echo 'make ask WHO="their name" AMOUNT="¥1"'; exit 1; }
	@test -n "$(AMOUNT)" || { echo 'make ask WHO="$(WHO)" AMOUNT="¥1"'; exit 1; }
	@# BOARD_PUBLIC_URL, or it prints http://board:8080/pay/... — a real page
	@# that only exists inside the compose network. The same arrangement
	@# `make back` has always had.
	@# AND ON DEALIO'S OWN NAME WHEN THERE IS ONE. The link printed here is
	@# the link that gets pasted into WeChat, and it was carrying the board's
	@# domain — so the payer opened a page about money under the name of a
	@# private networking board. ask.mjs prefers the second when it is set.
	$(COMPOSE) run --rm --no-deps -T \
	  -e BOARD_PUBLIC_URL="https://$$(grep -E '^TOMSCODING_BOARD_DOMAIN=' .env | tail -1 | cut -d= -f2- | tr -d '\"')" \
	  -e BOARD_DEALIO_URL="$$(grep -E '^TOMSCODING_DEALIO_DOMAIN=' .env | tail -1 | cut -d= -f2- | tr -d '\"')" \
	  -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/ask.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --who "$(WHO)" --amount "$(AMOUNT)" --to "$(TO)" --for "$(FOR)" --when "$(WHEN)" --cur "$(CUR)" \
	  $(if $(TRY),--try,)

orders: ## What is waiting to be sent: make orders [ALL=1]
	@# THE SELLER'S WHOLE SCREEN, and it is this. The address as the courier
	@# needs it, the English names because a warehouse in Melbourne cannot
	@# pick from Chinese ones, and a number per row so nothing has to be
	@# copied out of a terminal.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/orders.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  $(if $(ALL),--all,)

ship: ## It has gone: make ship N=1 TRACKING="XD91260039AU" [COURIER="迅达速递"]
	@# N is the number beside it in `make orders`, not an id — twenty
	@# characters copied out of a terminal is the step that goes wrong. The
	@# list is re-read inside this command, so the number means what it just
	@# printed.
	@test -n "$(N)" || { echo 'make ship N=1 TRACKING="XD91260039AU"'; exit 1; }
	@test -n "$(TRACKING)" || { echo 'make ship N=$(N) TRACKING="XD91260039AU"'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/orders.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --ship "$(N)" --tracking "$(TRACKING)" --courier "$(COURIER)"

owed: ## What each shopfront has earned: make owed [PAY=1]
	@# A commission becomes owed when the money arrives, not when the order
	@# is made — nobody is paid out of a cart.
	@#
	@# It goes by itself the moment an order settles. PAY=1 is the sweep for
	@# the ones that could not go at the time — almost always money that had
	@# not landed in the account yet. Safe to run twice: a row already paid
	@# is skipped.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/owed.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  $(if $(PAY),--pay,)

catalogue: ## Everything in the shop, numbered: make catalogue
	@# Which things have a picture and which do not, because a product with
	@# a grey square where a tin should be does not sell in China.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/catalogue.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)"

photo: ## A picture on one of them: make photo N=1 URL="https://…/tin.jpg"
	@# THE PICTURE IS FETCHED ONTO THIS BOARD, not linked to. A page whose
	@# images come from an Australian host loads slowly in Shanghai and
	@# sometimes not at all, and a link that rots takes the shop with it.
	@#
	@# N is the number beside it in `make catalogue`.
	@test -n "$(N)" || { echo 'make photo N=1 URL="https://…/tin.jpg"'; exit 1; }
	@test -n "$(URL)" || { echo 'make photo N=$(N) URL="https://…/tin.jpg"'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/catalogue.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --n "$(N)" --url "$(URL)"

product-photo: ## A picture from a file: make product-photo N=1 < ~/Desktop/tin.jpg
	@# THE PHOTOGRAPH IS ALREADY ON THE MACHINE — a screenshot out of the
	@# old store, or the picture taken in the aisle. Uploading it somewhere
	@# to get a link, so the link can be pasted into `make photo`, is two
	@# accounts in the middle of a one-line job, so the file goes up the
	@# pipe with the command.
	@#
	@# From the Mac:
	@#   ssh root@… 'cd ~/tc && make product-photo N=1' < ~/Desktop/tin.jpg
	@test -n "$(N)" || { echo 'make product-photo N=1 < tin.jpg'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/product-photo.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --n "$(N)"

product-off: ## Take one off the shop entirely: make product-off N=2 [BACK=1]
	@# Not sold out — gone. For the ¥1 test row, and for anything that
	@# should not be on a shopfront a customer is looking at.
	@test -n "$(N)" || { echo 'make product-off N=2'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/catalogue.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --n "$(N)" --off "$(if $(BACK),0,1)"

sold-out: ## Hide the buy button on one: make sold-out N=1 [BACK=1]
	@test -n "$(N)" || { echo 'make sold-out N=1'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/catalogue.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --n "$(N)" --out "$(if $(BACK),0,1)"

catalogue-tidy: ## The same thing twice? make catalogue-tidy [PLEASE=1]
	@# A shopfront with the same tin on it three times does not read as a
	@# big shop, it reads as a broken one. Prints what it would take off;
	@# PLEASE=1 does it. It keeps the copy with a picture on it, and it
	@# takes rows off the shopfront rather than deleting them, so an order
	@# that already points at one still reads.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/catalogue-tidy.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  $(if $(PLEASE),--go,)

shelves: ## Put what is already there onto shelves: make shelves
	@# A one-off for rows added before shelves existed. It guesses from the
	@# name, prints what it decided, and leaves anything it is unsure about
	@# alone — a wrong shelf is worse than none, because she taps 奶粉 and
	@# does not find the milk powder.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/shelf-kinds.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)"

product-kind: ## Which shelf it sits on: make product-kind N=1 KIND="奶粉"
	@# Eight things in one column is a list; eight under three headings is
	@# a shop. Written rather than guessed from the name — no amount of
	@# string matching knows that 爱他美 is milk powder.
	@test -n "$(N)" || { echo 'make product-kind N=1 KIND="奶粉"'; exit 1; }
	@test -n "$(KIND)" || { echo 'make product-kind N=$(N) KIND="奶粉"'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/catalogue.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --n "$(N)" --kind "$(KIND)"

product: ## Put something in the catalogue: make product NAME="…" PRICE="¥648" [UNIT="900g *3" EN="…" PHOTO=url KIND="奶粉"]
	@# One seller, one catalogue, and he does not need a screen to type a
	@# price into. NAME is what she reads, so it is Chinese; EN is what the
	@# warehouse picks from.
	@test -n "$(NAME)" || { echo 'make product NAME="Bellamy 贝拉米3段 900g" PRICE="¥648"'; exit 1; }
	@test -n "$(PRICE)" || { echo 'make product NAME="$(NAME)" PRICE="¥648"'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/product.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --name "$(NAME)" --price "$(PRICE)" --unit "$(UNIT)" --en "$(EN)" --photo "$(PHOTO)" \
	  --kind "$(KIND)"

pay-list: ## The transfers to send by hand: make pay-list
	@# EVERY STOREFRONT IS RUN FROM CHINA, and Airwallex will not take a
	@# yuan beneficiary yet, so a representative is paid by one transfer
	@# each. This prints who, which bank, the card number and how much —
	@# largest first, one per screen — and it prints card numbers, which
	@# is the point of it. Then cross it off with `make paid-out`.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/pay-list.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)"

paid-out: ## That one is sent: make paid-out WHO="Mei"
	@# A list that cannot be crossed off prints the same payment next week,
	@# and the week after somebody sends it twice.
	@test -n "$(WHO)" || { echo 'make paid-out WHO="Mei"'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/paid-out.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --who "$(WHO)"

weidian-pull: ## Read the old 微店 shop: make weidian-pull SHOP=https://weidian.com/s/1202970134 [MAX=40]
	@# NOT LOGGED IN. Everything it reads is what any customer sees — a seller
	@# login driven from this box is the thing that gets an account looked at,
	@# and the reviews are public. It runs in the post-browser image because
	@# weidian.com draws itself with JavaScript: a plain fetch gets the shop's
	@# name and nothing else.
	@#
	@# Writes /data/weidian.json inside post_data. `make weidian-json` prints
	@# it, and the reviews go in per item with `make review-import`.
	@test -n "$(SHOP)" || { echo 'which shop? make weidian-pull SHOP=https://weidian.com/s/1202970134'; exit 1; }
	@# MOUNTED AT /app/seed, NOT /seed. playwright is installed at
	@# /app/node_modules in this image, and an ESM bare specifier resolves by
	@# walking up from the importing FILE — from /seed that is /seed then /,
	@# so it never saw it and every run died with ERR_MODULE_NOT_FOUND. One
	@# directory deeper inside /app and the ordinary walk finds it.
	@#
	@# AS ROOT, AND WITH THE BROWSER PATH SAID OUT LOUD. browser.Dockerfile
	@# runs `npx playwright install` on line 21 as root, then drops to
	@# USER 1000:1000 on line 31 — so Chromium sits in /root/.cache, which
	@# mode-700 keeps uid 1000 out of. Playwright then reports it as "just
	@# installed, run npx playwright install", which sends you off to fix the
	@# image when the image is fine and only the reader is wrong. Naming the
	@# path removes the guess from HOME as well.
	@$(COMPOSE) --profile post run --rm --no-deps -T -v "$(CURDIR)/scripts:/app/seed:ro" post-browser \
	  node /app/seed/weidian-pull.mjs --shop "$(SHOP)" --out /data/weidian.json --max "$(or $(MAX),40)"

weidian-json: ## Print what weidian-pull read: make weidian-json
	@$(COMPOSE) --profile post run --rm --no-deps -T post-browser \
	  node -e 'const d=require("fs").readFileSync("/data/weidian.json","utf8");process.stdout.write(d)'

weidian-reviews: ## Old 微店 reviews onto the matching products: make weidian-reviews SHOP=https://weidian.com/s/1202970134 [MAX=40] [DRY=1]
	@# ONE COMMAND, BECAUSE THE JOIN USED TO BE FORTY.
	@# weidian-pull writes every item and its reviews into /data/weidian.json;
	@# review-import takes ONE product, by its number in `make catalogue`, and
	@# a flat file. Filling forty of those in by hand, each with a number that
	@# has to be right, is the work this box exists to delete. This pulls (when
	@# SHOP is given), matches 微店 item to board product BY NAME, and posts the
	@# lot. It runs in post-browser because that is where /data/weidian.json
	@# is; it reaches the board over the compose network, so the board must be
	@# up.
	@#
	@# A NAME IT CANNOT PLACE IS LEFT OUT AND PRINTED, never guessed at. The
	@# reviews are the one thing on that shopfront asking to be believed, and
	@# somebody's words about formula filed under a jar of honey would never
	@# be found again. DRY=1 shows what it would match and writes nothing.
	@if [ -n "$(SHOP)" ]; then $(MAKE) weidian-pull SHOP="$(SHOP)" MAX="$(or $(MAX),40)"; fi
	@# Root here too, so it can read the weidian.json the pull just wrote as
	@# root. It runs no browser, but the file is the whole point of it.
	@$(COMPOSE) --profile post run --rm --no-deps -T -v "$(CURDIR)/scripts:/app/seed:ro" post-browser \
	  node /app/seed/weidian-reviews.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --file /data/weidian.json $(if $(DRY),--dry,)

review-import: ## All the old reviews at once: make review-import N=1 FILE=scripts/reviews-1.json
	@# The file is a JSON array: [{"who":"李娜","stars":5,"text":"…","at":"2024-11-02"}, …]
	@# Safe to run twice — the same words on the same thing are dropped.
	@# Every one is labelled 来自老店 on the page.
	@test -n "$(N)" || { echo 'make review-import N=1 FILE=scripts/reviews-1.json'; exit 1; }
	@test -n "$(FILE)" || { echo 'make review-import N=$(N) FILE=scripts/reviews-1.json'; exit 1; }
	@test -f "$(FILE)" || { echo "No such file: $(FILE)"; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR):/seed:ro" --entrypoint node board \
	  /seed/scripts/review-import.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --n "$(N)" --file "/seed/$(FILE)"

review-add: ## An old review from the WeChat store: make review-add N=1 WHO="李娜" TEXT="…" [STARS=5 PHOTO=url AT=2024-03-11]
	@# N is the number beside the thing in `make catalogue`.
	@#
	@# IT IS LABELLED 来自老店 ON THE PAGE. The reviews written here are
	@# worth reading because an order nobody can fake stands behind them;
	@# one typed in has nothing behind it but your word. Saying so is what
	@# keeps the others worth anything.
	@test -n "$(N)" || { echo 'make review-add N=1 TEXT="孩子很爱喝"'; exit 1; }
	@test -n "$(TEXT)" || { echo 'make review-add N=$(N) TEXT="孩子很爱喝"'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/review-add.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --n "$(N)" --text "$(TEXT)" --who "$(WHO)" --stars "$(STARS)" --photo "$(PHOTO)" --at "$(AT)"

shop-contact: ## How her buyers reach her: make shop-contact WHO="Mei" WECHAT="meimei_au" [QR=url] [WEIDIAN=url] [AI=1]
	@# 联系店家 sits bottom left on the shopfront, beside the buy button,
	@# because that is where it is on every Chinese shop she has used.
	@# WECHAT is an id she can search for, QR a code she can long press;
	@# either alone is fine and neither wipes the other.
	@#
	@# AI=1 turns the assistant on for this shop, AI=0 off.
	@test -n "$(WHO)" || { echo 'make shop-contact WHO="Mei" WECHAT="meimei_au"'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/shop-contact.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --who "$(WHO)" $(if $(WECHAT),--wechat "$(WECHAT)",) --qr "$(QR)" \
	  $(if $(WEIDIAN),--weidian "$(WEIDIAN)",) $(if $(AI),--ai "$(AI)",)

shop-check: ## What a shop row holds: make shop-check WHO="Tom"
	@# What is stored, and whether the picture behind it is still on disk
	@# — two questions that were being answered as one.
	@test -n "$(WHO)" || { echo 'make shop-check WHO="Tom"'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/shop-check.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --who "$(WHO)"

shop-brand: ## Dress a storefront: make shop-brand WHO="Tom" NAME="澳洲爸爸汤姆" [BANNER=url]
	@# A HANDLE AND A GREY CIRCLE IS NOT A SHOP. The name is the one she
	@# reads, so it is Chinese; the banner is fetched onto this board
	@# rather than linked, for the same reason the product pictures are.
	@#
	@# WHO is the handle on the board — `make who` has them.
	@# Either one alone is fine: NAME does not wipe the banner, and
	@# BANNER does not wipe the name.
	@test -n "$(WHO)" || { echo 'make shop-brand WHO="Tom" NAME="澳洲爸爸汤姆"'; exit 1; }
	@test -n "$(NAME)$(BANNER)" || { echo 'make shop-brand WHO="$(WHO)" NAME="澳洲爸爸汤姆" [BANNER=url]'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/shop-brand.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --who "$(WHO)" $(if $(NAME),--name "$(NAME)",) --banner "$(BANNER)"

dns-point: ## Point a domain at this box: make dns-point DOMAIN=aozhoubaba.com [KEY="pk1_…" SECRET="sk1_…"]
	@# THIS BLOCKED TWO THINGS IN ONE DAY. A domain bought at Porkbun arrives
	@# with an ALIAS and a wildcard CNAME aimed at their parking page, and
	@# until both are gone the name answers from a holding server whatever
	@# else is deployed. Finding that out by hand means reading a table of
	@# seven records on a screen that is hard to read, working out which two
	@# are the problem, deleting them in the right order — the apex ALIAS has
	@# to go before an A record can take its place — and adding two more.
	@#
	@# It keeps the MX rows and the SPF line. Taking those out stops mail
	@# arriving and nobody ever connects the two.
	@#
	@# The keys go in once and are remembered. Porkbun → Account → API
	@# Access: switch it on FOR THE DOMAIN, which is a per-domain toggle and
	@# the usual reason a correct key is still refused, then make a pair.
	@#
	@# ONLY FROM THE COMMAND LINE, like airwallex-keys: this box may have KEY
	@# in its environment and make would otherwise hand it to a command that
	@# named no key at all.
	@bash scripts/dns-point.sh \
	  $(if $(DOMAIN),--domain "$(DOMAIN)",) \
	  $(if $(IP),--ip "$(IP)",) \
	  $(if $(filter command line,$(origin KEY)),--key "$(KEY)",) \
	  $(if $(filter command line,$(origin SECRET)),--secret "$(SECRET)",)

shop-open: ## Open the shop on its own name: make shop-open WHO="Tom" NAME="澳洲爸爸汤姆" [WECHAT="…"] [DOMAIN=aozhoubaba.com]
	@# EVERY PIECE OF THIS EXISTED AND NONE OF IT WAS ONE COMMAND. Opening the
	@# shop front was: edit two lines in .env over SSH, bring the stack up,
	@# hope the hostname did not collide with another site block, run
	@# shop-brand, remember shop-contact, then find out from a browser whether
	@# DNS had ever been pointed at this box. Six steps, four of which fail
	@# without saying anything.
	@#
	@# It checks the handle, the DNS and the site blocks before it writes, so
	@# a wrong one costs nothing — the lesson off airwallex-keys, which used to
	@# overwrite working keys with a pair it had not tested yet.
	@#
	@# WHO is the handle on the board, not a first name: /shop/ matches on it
	@# and `make who` is the only place that knows it.
	@bash scripts/shop-open.sh \
	  $(if $(WHO),--who "$(WHO)",) \
	  $(if $(NAME),--name "$(NAME)",) \
	  $(if $(DOMAIN),--domain "$(DOMAIN)",) \
	  $(if $(WECHAT),--wechat "$(WECHAT)",)

shop-story: ## His own words on the shopfront: make shop-story WHO="Tom" TEXT="我在墨尔本…"
	@# THE PART THAT IS NOT THE CATALOGUE. Nobody in China buys formula from
	@# a storefront because the storefront had formula — they buy it from
	@# 小美, whose 朋友圈 they have followed for a year, because she is
	@# standing in the aisle in Melbourne and they are not. Three or four
	@# sentences under his face: who he is, where he is, why he started.
	@#
	@# WRITE IT IN CHINESE. It is stored exactly as typed and never rendered
	@# into the other language — a machine version of somebody's own voice
	@# is the one thing on this page that must not be automatic.
	@#
	@# TEXT="" clears it.
	@test -n "$(WHO)" || { echo 'make shop-story WHO="Tom" TEXT="我在墨尔本，女儿两岁…"'; exit 1; }
	@test -n "$(filter command line,$(origin TEXT))" || { echo 'make shop-story WHO="$(WHO)" TEXT="我在墨尔本…"'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/shop-brand.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --who "$(WHO)" --story "$(TEXT)"

shop-chapter: ## One moment of the story: make shop-chapter WHO="Tom" WHEN="2019" TEXT="…" [PHOTO=url] [CLEAR=1]
	@# 店主的故事 is the level below the paragraph on the shopfront: a year
	@# and a line each, down a rule. Run it once per moment — that is how
	@# somebody writes this, one remembered thing at a time.
	@#
	@# THE ONE THAT CLOSED IS THE POINT. A shop listing only its wins is
	@# making claims; "在北京开了店，2023 年关了" is a person talking.
	@#
	@# WHEN is free text: 2019, 2019年, or 女儿出生那年. CLEAR=1 empties it.
	@test -n "$(WHO)" || { echo 'make shop-chapter WHO="Tom" WHEN="2019" TEXT="在微信上卖第一罐奶粉"'; exit 1; }
	@test -n "$(CLEAR)$(WHEN)$(TEXT)" || { echo 'make shop-chapter WHO="$(WHO)" WHEN="2019" TEXT="…"'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/shop-chapter.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --who "$(WHO)" $(if $(CLEAR),--clear,--when "$(WHEN)" --text "$(TEXT)" $(if $(PHOTO),--photo "$(PHOTO)",))

shop-banner: ## The picture, from a file: make shop-banner WHO="Tom" < dad.png
	@# THE PICTURE IS ALREADY ON HIS MACHINE. Uploading it somewhere to get
	@# a link, so the link can be pasted into another command, is two
	@# accounts and a screen in the middle of a one-line job — so the file
	@# goes up the pipe with the command.
	@#
	@# From the Mac, in one line:
	@#   ssh root@… 'cd ~/tc && make shop-banner WHO="Tom"' < ~/Desktop/dad.png
	@#
	@# It does not touch the name — a new picture is not a rename.
	@test -n "$(WHO)" || { echo 'make shop-banner WHO="Tom" < dad.png'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/shop-banner.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --who "$(WHO)"

airwallex-keys: ## Keys in and proved, in one line: make airwallex-keys CLIENT_ID="…" API_KEY="…" [WHO="Tom"] [LIVE=1]
	@# THE STEP THAT WAS NEVER A COMMAND. Every other instruction here ended
	@# with "put the client id and the API key in .env first", which means
	@# editing a file on a server over SSH to place two long strings on two
	@# exact lines. So they come in as arguments, and the command that writes
	@# them is the same command that proves they work.
	@#
	@# Developer → API keys in the Airwallex dashboard has both. The sandbox
	@# and the live account have different pairs; LIVE=1 says which you hold,
	@# and without it the box stays pointed at the sandbox.
	@#
	@# WHO is optional and is the handle on the board. Give it and the run
	@# ends with that person's requests drawing a real code and a one-yuan
	@# request to open on a phone — keys to a scannable code in one line.
	@#
	@# ONLY FROM THE COMMAND LINE, the same as dealio-webhook below: this box
	@# has an API_KEY in its environment, and make would otherwise hand that
	@# to a command that named no key at all.
	@bash scripts/airwallex-keys.sh \
	  $(if $(filter command line,$(origin CLIENT_ID)),--client-id "$(CLIENT_ID)",) \
	  $(if $(filter command line,$(origin API_KEY)),--api-key "$(API_KEY)",) \
	  $(if $(filter command line,$(origin WHO)),--who "$(WHO)",) \
	  $(if $(filter command line,$(origin LIVE)),--live,)

wallet-why: ## Why a code will not draw, in the provider's own words: make wallet-why
	@# THE QUESTION A DEAD PAY BUTTON ASKS, ANSWERED BY THE THING THAT KNOWS.
	@# A payer pressing WeChat Pay and being told "WeChat Pay would not take
	@# this one" is being told the truth and nothing useful: the page only
	@# knows the server said no. The reason is one layer down, in the
	@# provider's own answer, and until now reading it meant sshing in,
	@# finding the right env var names and running a check script by hand —
	@# four steps to answer "why is it broken".
	@#
	@# NO KEYS ARE PASSED. That is the point: it runs against whatever is in
	@# .env on this box right now, which is the only configuration whose
	@# health is worth knowing. Read-only — it logs in and reads a rate.
	@# Nothing it does moves money or changes a setting.
	@W=$$(grep -E '^TOMSCODING_BOARD_WALLET=' .env | tail -1 | cut -d= -f2- | tr -d '"'); \
	  if [ -z "$$W" ]; then \
	    echo "The wallet is switched off on this box (TOMSCODING_BOARD_WALLET is empty)."; \
	    echo "Nothing will draw a code until it names a provider: test, airwallex or qfpay."; \
	    exit 0; \
	  fi; \
	  echo "provider: $$W"; echo; \
	  case "$$W" in \
	    airwallex) $(COMPOSE) run --rm --no-deps -T --entrypoint node board \
	        lib/wallet/providers/airwallex.check.mjs ;; \
	    qfpay) $(COMPOSE) run --rm --no-deps -T --entrypoint node board \
	        lib/wallet/providers/qfpay.check.mjs ;; \
	    test) echo "The stand-in provider. It draws a code, but it is not a real one:"; \
	        echo "WeChat will scan it and find no payment behind it, and the row goes"; \
	        echo "green after six seconds on its own. Fine for showing the screens."; \
	        echo "Real keys through: make airwallex-keys CLIENT_ID=... API_KEY=..." ;; \
	    *) echo "TOMSCODING_BOARD_WALLET is \"$$W\", which is not a provider this board has." ;; \
	  esac

payout-try: ## Can this Airwallex account pay anybody: make payout-try
	@# THE QUESTION THE SUBCONTRACTOR HALF RESTS ON, asked before a day is
	@# spent building on it. Transfers and beneficiaries are activated
	@# separately from taking payments, and an account still in review may
	@# have neither.
	@#
	@# Sandbox money and fake bank details. It prints whatever Airwallex
	@# says, including the refusal, which is the part worth having.
	$(COMPOSE) run --rm --no-deps -T --entrypoint node board \
	  lib/wallet/providers/airwallex.payout.mjs

dealio-webhook: ## Airwallex tells us a code was paid: make dealio-webhook [SECRET="…"] [OFF=1]
	@# Without it a row still goes green — but only once somebody opens a
	@# page, because asking is the only witness. The commonest shape of a
	@# payment is nobody looking at all: the payer closes the tab and the
	@# person owed the money is asleep.
	@#
	@# Run it with no arguments and it prints the address to paste into
	@# Airwallex's dashboard, which is the one step that cannot be a command
	@# — they register endpoints there and show the signing secret once.
	@#
	@# ONLY FROM THE COMMAND LINE. make imports the environment as its own
	@# variables, and this box has a SECRET in its environment: the script
	@# read it, stored it, and said "Listening" about a webhook that could
	@# never have verified a signature. $(origin) is how make tells the two
	@# apart, and what is not passed is not read.
	@bash scripts/dealio-webhook.sh \
	  $(if $(filter command line,$(origin SECRET)),--secret "$(SECRET)",) \
	  $(if $(filter command line,$(origin OFF)),--off,)

dealio-me: ## Dealio's codes, for one person's own requests: make dealio-me WHO="Tom" [OFF=1]
	@# WHAT IT TURNS ON. A request in yuan by that person, paid by WeChat Pay
	@# or Alipay, draws a real Airwallex code on the payer's page instead of
	@# the demo box. They long-press it, pay in the wallet they already have
	@# open, and the row settles on its own.
	@#
	@# ONE PERSON, BECAUSE THE MONEY HAS ONE DESTINATION. Every payment these
	@# keys confirm lands in the account they belong to. Paying anybody else
	@# needs connected accounts, which Airwallex has not approved yet.
	@#
	@# It prints a one-yuan request at the end, so the handle is checked here
	@# rather than on somebody's phone.
	@bash scripts/dealio-me.sh

stripe-names: ## Repair .env after an old go-live wrote the wrong names: make stripe-names
	@# ONE-OFF, AND SAFE TO RUN TWICE. An earlier go-live wrote the
	@# container-internal names into .env — BOARD_STRIPE_KEY rather than
	@# TOMSCODING_BOARD_STRIPE_KEY — and compose reads the second. So the live
	@# key sat in the file under a name nothing looks at while the old sandbox
	@# key kept the name that matters, and .env, go-live and pay-check each
	@# told the truth about something different.
	@#
	@# go-live writes the right names now. This is for a box that already has
	@# the wrong ones. Nothing to move means it says so and changes nothing.
	@bash scripts/stripe-names.sh

sign-in-code: ## One sign-in code that keeps working: make sign-in-code CODE="XXXXXX" WHO="Tom"
	@# WHY IT IS NOT make back. That one mints six random characters and
	@# spends them on use — right for a member who lost their phone, because
	@# a code that keeps working is a code that ends up in a group chat, and
	@# wrong for the person who runs the board, for whom it is a weekly chore
	@# of running a command and reading six random characters off a screen.
	@#
	@# This is one code, chosen, that never spends. Six characters, no I O 0
	@# or 1. WHO is the handle on the board — make who, if it is not obvious.
	@#
	@# IT IS A PASSWORD ON A PUBLIC DOOR. Whoever types it becomes that
	@# person: their requests, the account their money lands in, and every
	@# member they can see. Five wrong answers an hour per browser is the
	@# whole wall, so six characters somebody would try first — a name, a
	@# word, the same letter six times — are not behind it at all.
	@#
	@# Take it away with: make sign-in-code OFF=1
	@bash scripts/sign-in-code.sh

go-live: ## Put the real Stripe keys on: make go-live
	@# REAL MONEY AFTER THIS. Every charge has this platform as merchant of
	@# record, so it is a thing to run once you have read Stripe's terms and
	@# not before.
	@#
	@# It asks for the three values, shows none of them, writes them into
	@# .env, brings the box up, and clears every payout account on the board —
	@# which is the step nobody would know to take. A connected account minted
	@# under a test key does not exist under a live one: left in place, the
	@# payment opens and Stripe refuses an account it has never heard of,
	@# and the screen blames the payer.
	@#
	@# The old .env is kept beside it as .env.before-stripe-keys.
	@bash scripts/stripe-keys.sh live

go-test: ## Put the sandbox Stripe keys back: make go-test
	@# The same thing the other way. Payout accounts are cleared again — they
	@# do not cross between modes in either direction.
	@bash scripts/stripe-keys.sh test

pay-try: ## Why a payment was refused, in Stripe's words: make pay-try ID=... [METHOD=wechat]
	@# THE THREE METHODS, ASKED OF STRIPE, WITH THE REASON UNDER EACH.
	@#
	@# WeChat Pay was refused and the other two were never pressed, so the
	@# phone read as "none of the payments work" — and the reason existed in
	@# one line of a container log that nobody would know to go and read.
	@#
	@# ID is the end of the request's address: thexchange.app/pay/<this bit>.
	@# It opens real checkout sessions and abandons them. Nothing is charged —
	@# a session nobody completes expires — and nothing is written down.
	@test -n "$(ID)" || { echo 'make pay-try ID=... — the bit after /pay/ in the link'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/pay-try.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --id "$(ID)" --method "$(METHOD)"

hook-make: ## Make the Stripe webhook and print its secret: used by make go-live
	@# NOT FOR TYPING. `make go-live` calls it and catches the secret in a
	@# variable; run by hand it prints a live signing secret onto a screen and
	@# into a scrollback, which is the one place it must never be.
	@#
	@# The key comes through the environment and not as an argument: argv is
	@# visible in `ps` to anybody on the box for as long as the call lasts.
	@$(COMPOSE) run --rm --no-deps -T -e BOARD_STRIPE_KEY \
	  -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/stripe-hook.mjs "$(URL)" "$(VERSION)"

payee-names: ## Who has a payout account, one per line: make payee-names
	@# For `make go-live` rather than for reading. `make pay-check` says the
	@# same thing in a sentence.
	@$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/pay-check.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --names

pay-check: ## Can this board take a payment, and if not why: make pay-check
	@# "Can the app do payments" is a question about the running box, and the
	@# answer turns on five variables in .env and one setting inside Stripe.
	@# Answering it by reading a commit is answering it by guessing.
	@#
	@# NOTHING SECRET IS PRINTED. Whether each key is set, and whether the
	@# Stripe key's prefix says test or live. Never a key and never an
	@# account id.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/pay-check.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)"

dealsheet: ## An example deal in a real room: make dealsheet WHO="Tom" WITH="Christopher" [OFF=1]
	@# TO SEE ONE ON A PHONE. `make try` shows every screen on a laptop, except
	@# the only thing that matters about a deal: what it feels like arriving in
	@# a room with somebody you know, with a number on it.
	@#
	@# WHO IS THE ONE PAYING, WITH is the one doing the work, and both are
	@# handles — whatever the person typed when they arrived. `make who` lists
	@# them; a wrong one comes back "not on this board".
	@#
	@# The memo says "(example)" in its own title, because a sheet that reads
	@# like one somebody agreed to is a thing to be acted on a week later by
	@# whoever forgot. OFF=1 takes it away.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/dealsheet.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --who "$(WHO)" --with "$(WITH)" $(if $(OFF),--off,)

layers: ## Who is in which layer: make layers [FIX=1]
	@# The arrival number is stamped once, in the order of the date on each
	@# person's row, and nobody moves after that. A card written late for
	@# somebody who was here from the start carries a late date and lands in the
	@# wrong band for good — so read the first three back as three people you
	@# recognise, while it is still cheap to fix.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/layers.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  $(if $(FIX),--fix,)

mo-say: ## One line from the doorman, in every room: make mo-say WHAT="..." [ROOM=film]
	@# YOUR SENTENCE, NOT HIS. No model runs on this: he may not invent a fact
	@# about the world, which is the reason anything he says can be trusted.
	@# You write the line and he says it word for word, in the rooms people are
	@# already reading. Rooms: film invest raise trade other; none means all.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/mosay.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --text "$(WHAT)" --room "$(ROOM)"

bios: ## Render every card's line into the other language, once: make bios
	@# The language button switches everything on the board except the line on
	@# a card, which is the person's own words. Each one is now rendered into
	@# the other language when it is written; this is for the cards that were
	@# already up. Safe to run twice — it skips what is done.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/bios.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)"

card: ## Put somebody real on the board: make card NAME="Ray Chen" ME=investor WANT=producer LINE="..."
	@# ONLY FOR SOMEBODY YOU KNOW, whose card you could read out to them and
	@# have them say "yes, that's me". The line goes up as theirs. `make demo`
	@# is the other thing and it invents people on purpose; this one is for the
	@# people you brought, before they are holding a phone.
	@#
	@# Run it again on the same name to edit the line. Then:
	@#   make peek WHO="Ray Chen"   to show them at the door
	@#   make back WHO="Ray Chen"   to hand them the page for real
	@test -n "$(NAME)" || { echo 'whose card? make card NAME="Ray Chen" ME=investor WANT=producer LINE="..."'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/card.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --name "$(NAME)" --me "$(ME)" --want "$(WANT)" --line "$(LINE)" --by "$(or $(BY),Tom)"

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

waiting-rooms: ## The queue by room and by which half of the sentence they are
	@# Who to let in is a question about pairs, not about people — see the note
	@# at the top of the script. A want with nobody who IS it is a wall.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/waiting-rooms.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)"

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
	@# They appear on the members' waiting list, where a member can vouch for
	@# them — which is the point of writing them down. That did not happen
	@# until 12 Sep: this route never set `shown`, so every row added here was
	@# on the list and visible to nobody.
	@test -n "$(NAME)" -a -n "$(REACH)" || { echo 'both: make wait-add NAME="Wei" REACH="wechat weilin88" [WHY="..."]'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/waiting.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --name "$(NAME)" --reach "$(REACH)" --why "$(WHY)" --room "$(ROOM)"

waiting-in: ## Mark one as let in: make waiting-in ID=...
	@test -n "$(ID)" || { echo "which one? make waiting-in ID=..."; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/waiting.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" --in "$(ID)"

cfm-setup: ## Create the project and its packages: make cfm-setup
	@# Once, on a new box. The ledger knows nothing about The Exchange until it
	@# is told — a name, a line, and where to send somebody who accepts. See
	@# cfm/lib/store.js for why that is the whole of what it holds.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node cfm \
	  /seed/cfm.mjs http://cfm:3000 "$$(grep -E '^TOMSCODING_CFM_KEY=' .env | tail -1 | cut -d= -f2-)" setup

cfm-self: ## Put crowdfundme itself on the ledger: make cfm-self [PCT=10 YEARS=4 CLIFF=12 FROM="Tom Shanahan"]
	@# The second project, and the proof the boundary in cfm/lib/store.js held:
	@# a row and two calls, not a rewrite. Its package is a stake — a share of
	@# the ledger itself, for the people who build it rather than join it.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node cfm \
	  /seed/cfm.mjs http://cfm:3000 "$$(grep -E '^TOMSCODING_CFM_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  setup-cfm --pct "$(or $(PCT),10)" --years "$(or $(YEARS),4)" --cliff "$(or $(CLIFF),12)" \
	  --from "$(or $(FROM),Tom Shanahan)" --holds "$(HOLDS)"

cfm-owner: ## Let somebody else keep their own record: make cfm-owner NAME="Ana" [PROJECTS=1]
	@# Their own key, scoped to their own rows — not the master key, which
	@# opens every project and every offer on this box. The key prints once and
	@# no route reads it back; losing it means a new one, which is the right
	@# amount of ceremony for a key that opens somebody else's record.
	@test -n "$(NAME)" || { echo 'who? make cfm-owner NAME="their name"'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node cfm \
	  /seed/cfm.mjs http://cfm:3000 "$$(grep -E '^TOMSCODING_CFM_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  owner --name "$(NAME)" --projects "$(or $(PROJECTS),1)"

cfm-owners: ## Who keeps a record here, and how many projects each has
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node cfm \
	  /seed/cfm.mjs http://cfm:3000 "$$(grep -E '^TOMSCODING_CFM_KEY=' .env | tail -1 | cut -d= -f2-)" owners

cfm-grantor: ## Who grants a share and out of what: make cfm-grantor ID=the-exchange FROM="Tom Shanahan" HOLDS="..." [SIG=sig-tom.png]
	@# The two fields a project needs the day it makes its first stake offer,
	@# and never before it. A share in a company, on a page that does not name
	@# who is granting it or what holding it comes out of, is a screenshot
	@# rather than a record — and the person reading it is being asked to take
	@# a share instead of a salary.
	@#
	@# The full name, not the first one. It is on the record beside their
	@# signature.
	@test -n "$(FROM)" || { echo 'make cfm-grantor ID=the-exchange FROM="Tom Shanahan" HOLDS="Sole owner today..."'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node cfm \
	  /seed/cfm.mjs http://cfm:3000 "$$(grep -E '^TOMSCODING_CFM_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  grantor --id "$(or $(ID),the-exchange)" --from "$(FROM)" --holds "$(HOLDS)" \
	  --sig "$(SIG)"

gram: ## Make the square posts: make gram [PAIRS=scripts/gram/pairs.json]
	@# Writes into scripts/gram/out and a second copy into site/g, which is
	@# served at thexchange.app with no gate in front of it — Meta fetches the
	@# picture by URL and will not take an upload. Deploy after running this.
	node scripts/gram/make.mjs $(PAIRS)

gram-clips: ## Make the clips for the stills marked for one: make gram-clips [NAME=... DRY=1]
	@# The still has to be deployed first — ARK fetches the first frame by URL,
	@# so a 404 here is a missing deploy and not a missing key.
	set -a; . ./.env; set +a; \
	  node scripts/gram/clip.mjs $(if $(NAME),"$(NAME)",--all) $(if $(DRY),--dry,)

gram-next: ## Post the next one that has not gone out: make gram-next [DRY=1]
	@# What cron calls. Picks at random from whatever is left, posts it, and
	@# writes it into scripts/gram/posted.json — that ledger is the only thing
	@# between a cron entry and the same six posts every other day.
	set -a; . ./.env; set +a; \
	  node scripts/gram/next.mjs $(if $(DRY),--dry,)

gram-token: ## Refresh the Instagram token and write it back into .env
	@# It lasts sixty days and nothing warns you — it works, and then one
	@# morning posting stops with a message about the session. Monthly is fine.
	set -a; . ./.env; set +a; \
	  node scripts/gram/token.mjs --write

gram-list: ## What is made and ready to post
	node scripts/gram/post.mjs --list

gram-post: ## Post one: make gram-post NAME=agent-producer [DRY=1]
	@test -n "$(NAME)" || { echo 'which one? make gram-list'; exit 1; }
	@# GRAM_USER_ID and GRAM_TOKEN come from .env and never from the repo.
	set -a; . ./.env; set +a; \
	  node scripts/gram/post.mjs "$(NAME)" $(if $(DRY),--dry,)

post: ## Post one video everywhere: make post FILE=~/video.mp4 SAY="caption" [ZH="中文文案"] [ONLY=youtube,douyin]
	@# ONE COMMAND, ONE LINE PER PLATFORM. Running it twice does not post
	@# twice: the record in post_data is per platform, so a second run retries
	@# only what has not gone out. See post/README.md.
	@#
	@# NO ZH MEANS THE CHINESE PLATFORMS DO NOT GO OUT, and the command says so
	@# on their line. A machine-translated caption reads as foreign and costs
	@# the audience this whole thing is for.
	@test -n "$(FILE)" || { echo 'which file? make post FILE=~/video.mp4 SAY="caption"'; exit 1; }
	@test -n "$(SAY)" || { echo 'what does it say? make post FILE=~/video.mp4 SAY="caption"'; exit 1; }
	@test -f "$(FILE)" || { echo 'no such file: $(FILE)'; exit 1; }
	@# The video is mounted read-only from wherever it already is, rather than
	@# copied into the repo or into a volume: one video is 300MB and a copy
	@# nobody deletes is a disk that fills up in a month.
	@d=$$(cd "$$(dirname "$(FILE)")" && pwd); f=$$(basename "$(FILE)"); \
	  $(COMPOSE) --profile post run --rm --no-deps -T -v "$$d:/in:ro" post \
	    node cli.mjs post --file "/in/$$f" --say "$(SAY)" \
	    $(if $(ZH),--zh "$(ZH)",) $(if $(ONLY),--only "$(ONLY)",)

post-run: ## Do the queued 抖音/小红书 posts in a real browser: make post-run [ONLY=douyin]
	@# The browser half. `make post` queues these rather than doing them, so
	@# this is the command that actually opens Chromium, and it says which
	@# platform needs a login rather than failing quietly.
	@$(COMPOSE) --profile post run --rm --no-deps -T post-browser \
	  node browser/run.mjs run --where box $(if $(ONLY),--only "$(ONLY)",)

post-login: ## Log in to a Chinese platform by SMS: make post-login WHO=douyin PHONE=13800138000
	@# BY SMS, NOT BY QR. Every automation guide uses the QR code, and a QR is
	@# no use to somebody who cannot see the screen. This sends a code to the
	@# phone; `make post-code` types it back in.
	@test -n "$(WHO)" || { echo 'which one? make post-login WHO=douyin PHONE=13800138000'; exit 1; }
	@test -n "$(PHONE)" || { echo 'which number? make post-login WHO=$(WHO) PHONE=13800138000'; exit 1; }
	@$(COMPOSE) --profile post run --rm --no-deps -T post-browser \
	  node browser/run.mjs login --who "$(WHO)" --phone "$(PHONE)"

post-code: ## Finish the login with the six digits: make post-code WHO=douyin CODE=123456
	@test -n "$(WHO)" || { echo 'which one? make post-code WHO=douyin CODE=123456'; exit 1; }
	@test -n "$(CODE)" || { echo 'which code? make post-code WHO=$(WHO) CODE=123456'; exit 1; }
	@$(COMPOSE) --profile post run --rm --no-deps -T post-browser \
	  node browser/run.mjs code --who "$(WHO)" --code "$(CODE)"

post-logins: ## Which platforms are still logged in: make post-logins
	@# Worth running before a trip rather than finding out mid-post: these
	@# sessions expire every few weeks and nothing warns you.
	@$(COMPOSE) --profile post run --rm --no-deps -T post-browser \
	  node browser/run.mjs check

post-status: ## What went where: make post-status [ID=...] [N=10]
	@$(COMPOSE) --profile post run --rm --no-deps -T post \
	  node cli.mjs status $(if $(ID),--id "$(ID)",) $(if $(N),--n "$(N)",)

demo-board: ## Fill the demo board — the one a reviewer sees: make demo-board
	@# THE OTHER BOARD. `make demo` puts two invented neighbours beside a real
	@# member on the REAL board. This fills the demo container, where nobody is
	@# real and nothing here can touch board_data.
	@#
	@# Safe to run twice: the script works out who is already there.
	@#
	@# It refuses any board with a door on it, so a wrong container name is a
	@# refusal rather than eight invented people in the real room.
	@grep -qE '^COMPOSE_PROFILES=.*board-demo' .env \
	  || { echo 'board-demo is not in COMPOSE_PROFILES — the container is not running'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board-demo \
	  /seed/demo-board.mjs http://board-demo:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --device "$$(grep -E '^TOMSCODING_BOARD_DEMO_DEVICE=' .env | tail -1 | cut -d= -f2- | grep . || echo demoreviewer00000000000000000001)"

demo-board-rm: ## Empty the demo board completely: make demo-board-rm
	@# The volume, not the rows. Everything in it is invented, so there is
	@# nothing to preserve and nothing to be careful about — which is the one
	@# place on this box where that is true.
	$(COMPOSE) stop board-demo
	$(COMPOSE) rm -f board-demo
	docker volume rm -f tc_board_demo_data 2>/dev/null \
	  || docker volume rm -f $$(docker volume ls -q | grep board_demo_data | head -1) 2>/dev/null || true
	@echo 'Gone. make up, then make demo-board.'

demo: ## Two people who are not real, so you can see a full room: make demo WHO="Tom" [N=2]
	@# For "show me what it looks like when I have connections". They are named,
	@# their sentences answer yours, and they are gone again in one command.
	@#
	@# WHAT IT WILL NOT DO is act as somebody who exists. A row saying Hugo
	@# connected with you, when Hugo did not, is the one thing that makes the
	@# Cards tab worth nothing — including to whoever asked for it, who then
	@# cannot trust their own screen.
	@#
	@# Three steps, and the middle one is yours: they connect to you, you press
	@# Connect on each of them in Browse, then make demo-cards.
	@test -n "$(WHO)" || { echo 'whose room? make demo WHO="Tom"'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/demo.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  add --for "$(WHO)" --n "$(or $(N),2)"

demo-cards: ## They hand you their cards, once you have connected back: make demo-cards WHO="Tom"
	@test -n "$(WHO)" || { echo 'whose room? make demo-cards WHO="Tom"'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/demo.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  cards --for "$(WHO)"

demo-rm: ## Take the demo people back out again
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/demo.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  rm

cfm-project: ## A new project on the ledger: make cfm-project ID=laonei NAME="Laonei" [LINE="..." CLAIM="..." SUB="..." GOAL="..." MARKS="nil|today;$600k|two years" SEATS=0 GOTO=https://...]
	@# The ledger knows nothing about a project until it is told, and an offer
	@# for a project it has never heard of comes back as "The ledger refused
	@# that: bad" — which is the truth and is no help at all.
	@#
	@# GOTO is where somebody lands the moment they accept. Leave it out for a
	@# project whose offers are stakes: a stake opens nothing, and a link to a
	@# door they have no key to reads as a membership being sold.
	@#
	@# MARKS is up to three "value|when" pairs separated by semicolons. They
	@# are the project's own figures — the offer page draws what it is handed,
	@# so a project that sets none arrives wearing another one's numbers.
	@test -n "$(ID)" -a -n "$(NAME)" || { echo 'make cfm-project ID=laonei NAME="Laonei"'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node cfm \
	  /seed/cfm.mjs http://cfm:3000 "$$(grep -E '^TOMSCODING_CFM_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  project --id "$(ID)" --name "$(NAME)" --zh "$(ZH)" --line "$(LINE)" \
	  --goto "$(GOTO)" --seats "$(or $(SEATS),0)" \
	  --claim "$(CLAIM)" --sub "$(SUB)" --goal "$(GOAL)" --marks "$(MARKS)" --from "$(or $(FROM),Tom)"

cfm-stake: ## A share with an earn-out: make cfm-stake ID=aiden NAME="Founding engineer" PCT=5 STEPS="3|ships v1;2|25 projects on it"
	@# The half of a founder deal nobody writes down: five per cent now, more
	@# if something happens. It goes on the record here, in the words the two
	@# of you used, on a page that says when it was written.
	@#
	@# STEPS is one or more "percentage|what has to happen", separated by
	@# semicolons. The semicolon is the separator because the conditions are
	@# sentences and sentences have commas in them.
	@#
	@# The ledger holds these and judges none of them: there is no date to
	@# pass, nothing that ticks itself, and nothing here issues anything.
	@test -n "$(ID)" -a -n "$(NAME)" || { echo 'both: make cfm-stake ID=aiden NAME="Founding engineer" PCT=5'; exit 1; }
	@# STEPS goes through as ONE argument and cfm.mjs splits it. Splitting it
	@# here would mean a condition with a space in it arrives as three
	@# arguments, and a condition without spaces is not a sentence anybody
	@# wrote. One thing does the parsing.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node cfm \
	  /seed/cfm.mjs http://cfm:3000 "$$(grep -E '^TOMSCODING_CFM_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  stake --id "$(ID)" --name "$(NAME)" --project "$(or $(PROJECT),crowdfundme)" \
	  --pct "$(or $(PCT),5)" --years "$(or $(YEARS),4)" --cliff "$(or $(CLIFF),12)" \
	  --ask "$(ASK)" --why "$(WHY)" --steps "$(STEPS)"

cfm-offer: ## One offer to one person: make cfm-offer WHO="Keith" [PROJECT=the-exchange PACK=founding SEAT=3 NOTE="..." UNTIL=2026-09-16]
	@# The seat is written when the offer is made, not when it is opened. Two
	@# people quietly told they are third is the one mistake here that cannot
	@# be walked back.
	@test -n "$(WHO)" || { echo 'which one? make cfm-offer WHO="their name"'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node cfm \
	  /seed/cfm.mjs http://cfm:3000 "$$(grep -E '^TOMSCODING_CFM_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  offer --who "$(WHO)" --project "$(or $(PROJECT),the-exchange)" \
	  --pack "$(or $(PACK),founding)" --seat "$(or $(SEAT),0)" \
	  --note "$(NOTE)" --until "$(UNTIL)"

cfm-seal: ## Close a month and hash it: make cfm-seal [MONTH=2026-09]
	@# Chained to the seal before it, so re-sealing an old month breaks every
	@# seal since rather than passing quietly. Run it once a month. Nothing is
	@# published anywhere: this makes the record tamper-EVIDENT, and it says so
	@# — anchoring a hash publicly is a separate thing a project turns on.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node cfm \
	  /seed/cfm.mjs http://cfm:3000 "$$(grep -E '^TOMSCODING_CFM_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  seal --month "$(MONTH)"

cfm-keypair: ## Make a throwaway Stellar account for anchoring: make cfm-keypair
	@# Generated inside the container that already has the SDK — nothing to
	@# install, nothing to quote. It is printed once and stored nowhere: the
	@# only copy that should exist afterwards is the one you put in .env.
	@#
	@# It is a spending key. Use it for fees and nothing else.
	$(COMPOSE) run --rm --no-deps -T --entrypoint node cfm keypair.mjs

cfm-anchoring: ## Is anchoring on, which chain, and which account
	@# Off unless CFM_STELLAR_SECRET is set. Off is a real state and the pages
	@# say so — an un-anchored seal claims only that the record has not
	@# changed, which is a thing you are asking people to take on trust.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node cfm \
	  /seed/cfm.mjs http://cfm:3000 "$$(grep -E '^TOMSCODING_CFM_KEY=' .env | tail -1 | cut -d= -f2-)" anchoring

cfm-anchor: ## Put an already-sealed month on the chain: make cfm-anchor MONTH=2026-08
	@# For the first anchor after turning it on, and for one that failed
	@# because Horizon was busy. Sealing already does this by itself.
	@test -n "$(MONTH)" || { echo "which month? make cfm-anchor MONTH=2026-08"; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node cfm \
	  /seed/cfm.mjs http://cfm:3000 "$$(grep -E '^TOMSCODING_CFM_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  anchor --month "$(MONTH)"

cfm-verify: ## Check a month against the chain: make cfm-verify MONTH=2026-08
	@# Re-hashes the rows as they stand and reads the value back off Stellar
	@# rather than out of the file. A check that trusts the thing it is
	@# checking is not a check.
	@test -n "$(MONTH)" || { echo "which month? make cfm-verify MONTH=2026-08"; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node cfm \
	  /seed/cfm.mjs http://cfm:3000 "$$(grep -E '^TOMSCODING_CFM_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  verify --month "$(MONTH)"

cfm-unseal: ## Remove the newest seal (only the newest): make cfm-unseal
	@# Anything earlier is load-bearing — every seal after one hashes its hash,
	@# so pulling from the middle invalidates the rest without saying so. The
	@# last has nothing depending on it, which is why it is the only one that
	@# can go without leaving a lie behind.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node cfm \
	  /seed/cfm.mjs http://cfm:3000 "$$(grep -E '^TOMSCODING_CFM_KEY=' .env | tail -1 | cut -d= -f2-)" unseal

cfm-due: ## Is a finished month still unsealed? Asked on every deploy
	@# The one promise here that does not keep itself. See the `due` command.
	@$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node cfm \
	  /seed/cfm.mjs http://cfm:3000 "$$(grep -E '^TOMSCODING_CFM_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  due 2>/dev/null || true

cfm-seals: ## Every month sealed so far, and whether it was published
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node cfm \
	  /seed/cfm.mjs http://cfm:3000 "$$(grep -E '^TOMSCODING_CFM_KEY=' .env | tail -1 | cut -d= -f2-)" seals

cfm-reopen: ## Undo an acceptance, same code stays live: make cfm-reopen CODE=ABC123
	@# For the offer you accepted yourself while checking it — which is the
	@# first mistake anybody makes here. Minting a fresh code instead would
	@# leave a row saying somebody accepted who never did, on a record whose
	@# whole claim is that it does not say things like that.
	@test -n "$(CODE)" || { echo "which one? make cfm-reopen CODE=ABC123"; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node cfm \
	  /seed/cfm.mjs http://cfm:3000 "$$(grep -E '^TOMSCODING_CFM_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  reopen --code "$(CODE)"

cfm-void: ## Delete an offer that was never sent: make cfm-void CODE=ABC123
	@# Only for one nobody has read — a mis-typed name, a placeholder note.
	@# An offer somebody opened is part of what happened; reopen it or leave
	@# it, but do not make the record forget it.
	@test -n "$(CODE)" || { echo "which one? make cfm-void CODE=ABC123"; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node cfm \
	  /seed/cfm.mjs http://cfm:3000 "$$(grep -E '^TOMSCODING_CFM_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  void --code "$(CODE)"

cfm-offers: ## Who has been offered what, and who has opened it
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node cfm \
	  /seed/cfm.mjs http://cfm:3000 "$$(grep -E '^TOMSCODING_CFM_KEY=' .env | tail -1 | cut -d= -f2-)" offers

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

why-no-row: ## Why somebody in the room has no waiting row: make why-no-row
	@# Reads the data file rather than the API, because the question is about
	@# the device hash in the middle of the chain — which the API deliberately
	@# does not hand out. Answers where it breaks: never redeemed an invite, an
	@# invite nothing records spending, or a name the list no longer holds.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/why-no-row.mjs /data/board.json

room-keep: ## Keep only these in Browse: make room-keep KEEP="Keith,Axel,Hugo" [GO=1]
	@# The only command here that acts on everybody at once, with the names
	@# typed by hand at the moment of use — one letter wrong and that person
	@# goes out with the rest, quietly, because nothing on this board announces
	@# anything. So it prints the two lists and stops; GO=1 is a second,
	@# deliberate keystroke.
	@#
	@# It holds profiles rather than deleting anything: out of Browse, public
	@# page stops answering, posts untouched, nobody told, and `make show`
	@# puts one back. It does not touch the waiting list.
	@test -n "$(KEEP)" || { echo 'who stays? make room-keep KEEP="Keith,Axel"'; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/room-keep.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --keep "$(KEEP)" $(if $(GO),--go,)

waiting-up: ## Move one into the waiting room now: make waiting-up ID=...
	@# Three a day go up on their own, off the top of the queue — see liftSome
	@# in board/server.js. This is for the one you want looked at today
	@# regardless of where they are standing.
	@#
	@# It does NOT let them in. They can read the app and finish their page;
	@# every button tells them the rest is coming. Letting in is still
	@# make waiting-in, and still a separate decision.
	@# Inside the container, like every other script target here. The board is
	@# not published on the host — caddy is the only way in from outside, and
	@# curl on the box reaches neither.
	@test -n "$(ID)" || { echo "which one? make waiting-up ID=..."; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/waiting.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --up "$(ID)"

waiting-tell: ## The message to send somebody in the waiting room: make waiting-tell ID=...
	@# Nothing on this board can reach a WeChat id, so the board writes the
	@# message and you paste it. Their three days start when they OPEN it, not
	@# when you send it — see upSeen in board/lib/store.js.
	@test -n "$(ID)" || { echo "which one? make waiting-tell ID=..."; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/waiting.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --tell "$(ID)"

waiting-down: ## Put one back on the list from the waiting room: make waiting-down ID=...
	@test -n "$(ID)" || { echo "which one? make waiting-down ID=..."; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/waiting.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --down "$(ID)"

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

tell-rooms: ## Tell the list their room is open:  make tell-rooms [SEND=1] [AGAIN=1]
	@# Forty-seven people joined a queue and the queue is a room now — and not
	@# one of them knows, because nothing here reaches into WeChat. This is the
	@# list to work down: a block per person to paste, in their language, with
	@# their own room's link in it. Anybody who gave an address is mailed
	@# instead and drops off the list.
	@#
	@# NOTHING GOES OUT WITHOUT SEND=1 and nobody is marked without it either,
	@# so the first run is always a look. Run it again and only the people who
	@# have arrived since are in it.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/tell-rooms.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  $(if $(SEND),--send,) $(if $(AGAIN),--again,) \
	  --public "https://$$(grep -E '^TOMSCODING_BOARD_DOMAIN=' .env | tail -1 | cut -d= -f2- | tr -d '\"')"

peeks: ## Who somebody at the door can browse:  make peeks
	@# Five members, shown outside the door, so the waiting room is a reason to
	@# stay rather than a form and a clock. Then a wall with a number on it.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/peek.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)"

peek: ## Show one member outside the door:  make peek WHO="ray"
	@# WHO is their handle on the board, which is what `make peeks` prints — not
	@# their name. One at a time and on purpose: everybody else here decided to
	@# be in a directory MEMBERS read, and this one is read by strangers.
	@test -n "$(WHO)" || { echo "who? make peeks   to see the list"; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/peek.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --who "$(WHO)"

peek-off: ## Take one back inside:  make peek-off WHO="ray"
	@test -n "$(WHO)" || { echo "who? make peeks   to see the list"; exit 1; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/peek.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --who "$(WHO)" --off

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

mo: ## Why Mo said nothing: what he is missing, and what he last did
	@# FOUR PROBLEMS, ONE SYMPTOM. Somebody @'s him in a room and nothing comes
	@# back: no key, the model refused, the day's cap is gone, or the question
	@# never reached him at all. They look identical from a phone, and the
	@# afternoon goes on guessing. Every outcome is already written down — see
	@# the console.error calls in board/lib/butler.js and the "butler: silent"
	@# note in board/server.js. This reads them out.
	@echo ""
	@# AS THE CONTAINER SEES IT, not as .env reads. Those are two different
	@# questions and only one of them is the one that matters: a key in .env
	@# that compose does not pass through is a key the process does not have,
	@# and grepping the file would say yes to it.
	@if [ "$$($(COMPOSE) exec -T board node -e 'process.stdout.write(process.env.ANTHROPIC_API_KEY?"y":"n")' 2>/dev/null)" = "y" ]; then \
	  echo "  A model to think with   yes"; \
	else \
	  echo "  A model to think with   NO — the board container has no ANTHROPIC_API_KEY."; \
	  echo "                          It goes in .env, and the board has to be restarted after."; \
	fi
	@if grep -qE '^TOMSCODING_BOARD_BUTLER_NOW=.+' .env 2>/dev/null; then \
	  echo "  A line of your own      yes"; \
	else \
	  echo "  A line of your own      no — he answers from the board's own numbers either way."; \
	  echo "                          TOMSCODING_BOARD_BUTLER_NOW in .env is for the thing only you"; \
	  echo "                          know, like a co-production casting in Beijing this month."; \
	fi
	@echo ""
	@# EVERY OUTCOME, not only the silences — "ok" lines are how you tell a
	@# question that reached him and failed from one that never reached him.
	@out=$$($(COMPOSE) logs --tail=4000 board 2>/dev/null | grep "butler:" | tail -8); \
	if [ -n "$$out" ]; then \
	  echo "  The last few times he was asked something:"; \
	  echo "$$out" | sed "s/^.*butler:/   /"; \
	else \
	  echo "  He has not been asked anything since the board last started."; \
	  echo "  If somebody @'d him before that, the log went with the old container."; \
	fi
	@echo ""
	@echo "  The question itself is never written down. Only what happened to it."
	@echo ""

twice: ## Anybody on the list twice: make twice [WHO="Liza"]
	@# A waiting person's place is held by localStorage and a cookie, both
	@# per-origin. The move to thexchange.app was made with a 301, so anybody
	@# coming back on an old link met an empty form and filled it in again —
	@# leaving two rows, one with their card and one with just a name.
	@#
	@# Bare: names, dates and ids, and which rows are provably one person.
	@# WHO=: that one group in full, to decide the ones that are not provable.
	@# A name typed in on purpose, rather than sixty-three rows of contact
	@# details printed because somebody ran the summary.
	$(COMPOSE) run --rm --no-deps -T -e WHO="$(WHO)" -v "$(CURDIR)/scripts:/seed:ro" \
	  --entrypoint node board /seed/twice.mjs

bells: ## Which phones the board can reach, browser and app: make bells
	@# For the evening the app is first run onto a device. Xcode says whether
	@# registration failed and apns.js logs a 403, but "the token reached the
	@# board" is the step in between and there was nowhere to look at it.
	@# Counts and dates only — a device token names a phone.
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/bells.mjs

weidian-check: ## Does Weidian answer, and what does it actually say
	@# Run once, with real keys, before anything is built on top. It prints
	@# what comes back rather than a verdict, because the field names are in
	@# a wiki the build box cannot reach — see the head of lib/weidian.js.
	$(COMPOSE) run --rm --no-deps -T --entrypoint node board /app/scripts/weidian.check.mjs

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

match: ## Open a thread between two people:  make match A="Tom" B="Brendan"
	@# The same three tests as `make pair`, and it writes the two follow rows
	@# instead of telling you who has to tap them. For somebody you brought in
	@# by name: they arrive, and the person who invited them is unreachable
	@# until both of you have found each other in Browse. That is the right
	@# rule between two strangers and the wrong one here.
	@#
	@# It opens a thread. It does not move a contact — a card still needs both
	@# of them to press give — and it does not touch either sentence, so the
	@# rooms can still be the answer and it will say which box would fix it.
	@# Both of them need a finished page first: a follow points at a page.
	@test -n "$(A)" && test -n "$(B)" || { echo 'Two names:  make match A="Tom" B="Brendan"'; exit 2; }
	$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/pair.mjs http://board:8080 "$$(grep -E '^TOMSCODING_BOARD_KEY=' .env | tail -1 | cut -d= -f2-)" \
	  --a "$(A)" --b "$(B)" --make

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

save: ## Copy the board and the ledger out to ./backups — the two that cannot be rebuilt
	@# WHAT IS ACTUALLY IRREPLACEABLE ON THIS BOX. Everything else here is in
	@# git or can be rebuilt from it. These two are not: board.json holds the
	@# waiting list — names and the one way each of those people gave to reach
	@# them, typed once and stored nowhere else — and cfm.json is the record of
	@# who was offered what and who accepted.
	@#
	@# `make backup` tars the workspace homes, which is a different job: those
	@# are working directories. This is the data, it is small, and it is quick
	@# enough to run before every deploy.
	@#
	@# Read straight off the volumes with a throwaway container, so it works
	@# whether or not the services are up — including the case you want it for
	@# most, which is a box that will not start.
	@#
	@# The volume names come from `name: tomscoding` at the top of the compose
	@# file, not from the directory this is checked out into, so they are the
	@# same whether the clone is called tc or sage.
	mkdir -p backups
	@stamp=$$(date +%Y%m%d-%H%M%S); \
	  docker run --rm -v tomscoding_board_data:/board:ro -v tomscoding_cfm_data:/cfm:ro \
	    -v "$$PWD/backups:/out" alpine:3 \
	    sh -c 'tar czf /out/data-'"$$stamp"'.tar.gz -C / board cfm' \
	  && echo "wrote backups/data-$$stamp.tar.gz"
	@# And what went into it. Counted off the live volume, which is what was
	@# just copied — see data-count.mjs for why this is printed at all.
	@$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" \
	  --entrypoint node board /seed/data-count.mjs || true
	@ls -lh backups | tail -n 4

restore: ## Put a saved copy back: make restore FILE=backups/data-....tar.gz YES=1
	@# DELIBERATELY AWKWARD. This overwrites the live board and the live
	@# ledger, and what it is most likely to be used for is undoing a mistake
	@# made in a hurry — which is the worst frame of mind to be in while
	@# running something that cannot be undone. So it names the file, says what
	@# is inside it, and refuses without YES=1.
	@test -n "$(FILE)" || { echo 'which one? make restore FILE=backups/data-....tar.gz YES=1'; echo; ls -1t backups/data-*.tar.gz 2>/dev/null | head -5; exit 1; }
	@test -f "$(FILE)" || { echo "no such file: $(FILE)"; exit 1; }
	@rm -rf backups/.peek && mkdir -p backups/.peek
	@docker run --rm -v "$(CURDIR)/$(FILE):/in.tar.gz:ro" \
	  -v "$(CURDIR)/backups/.peek:/out" alpine:3 sh -c 'tar xzf /in.tar.gz -C /out'
	@echo "About to replace the live board and ledger with $(FILE), which holds:"
	@$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/backups/.peek:/peek:ro" \
	  -v "$(CURDIR)/scripts:/seed:ro" --entrypoint node board \
	  /seed/data-count.mjs /peek/board/board.json
	@test -n "$(YES)" || { echo; echo "Nothing done. Add YES=1 once you have read the line above."; exit 1; }
	@# The live copy first, always. Restoring the wrong file is a mistake
	@# somebody makes once, and it should not be the last thing that happens.
	$(MAKE) save
	$(COMPOSE) stop board cfm
	docker run --rm -v tomscoding_board_data:/board -v tomscoding_cfm_data:/cfm \
	  -v "$(CURDIR)/$(FILE):/in.tar.gz:ro" alpine:3 \
	  sh -c 'rm -rf /board/* /cfm/* && tar xzf /in.tar.gz -C /'
	$(COMPOSE) start board cfm
	@rm -rf backups/.peek
	@echo "Back. Look at the queue on the site before you do anything else."

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
	@# THIS .env FIRST, because it is the file that can be wrong tonight.
	@#
	@# This target checked two synthetic presets and not the deployment, which
	@# made it a trap rather than a check: it is the one somebody runs by name
	@# before touching a hostname, it printed a screen of green, and every line
	@# of it was about a .localhost fallback. The real run already happened
	@# inside `make up`, so nothing was ever deployed past a collision — but
	@# somebody reading this output would have believed they had checked the
	@# thing they had not checked, which is worse than no check at all.
	@#
	@# Both, in this order. The presets still earn their place: they are the
	@# only way to catch a collision that appears when an optional site is
	@# switched on later, on a box where it is off today.
	@test -f .env && python3 scripts/check-sites.py .env || 	  echo "no .env here — skipping the deployment's own file"
	python3 scripts/check-sites.py
	@# A render that throws halfway leaves the page looking like one whose data
	@# never arrived, which sends the hunt to the server and the network before
	@# anybody suspects the page. This asks the page directly.
	@#
	@# THROUGH A CONTAINER WHEN THE HOST HAS NO node, which is the case on the
	@# box: nothing needs installing on a server whose whole job is to run
	@# containers. It ran on the host and printed "node: command not found",
	@# which fails `make check` — and `make deploy` runs `make check` first, so
	@# one missing runtime on the host blocked every deploy. The same mistake
	@# `pitch` made once; same fix.
	@#
	@# The whole repo read-only rather than scripts alone: this one reads the
	@# analytics page out of the tree beside it.
	@if command -v node >/dev/null 2>&1; then \
	  node scripts/check-dashboard.mjs; \
	else \
	  $(COMPOSE) run --rm --no-deps -T -v "$(CURDIR):/repo:ro" --entrypoint node board \
	    /repo/scripts/check-dashboard.mjs; \
	fi

doctor: ## Check the path between you and the VPS
	bash scripts/doctor.sh

privacy: ## Show what public records say about who runs these sites
	@# Reads .env for the domains, then asks public registries. Nothing is
	@# changed and nothing is sent anywhere — it is the same lookup a stranger
	@# would do, run by you, on you.
	python3 scripts/privacy-check.py

try: ## Open the board on THIS machine, with a room in it, before deploying: make try
	@# THE SECOND TARGET IN HERE THAT RUNS ON THE LAPTOP AND NOT THE SERVER.
	@# (The other is `listing`.) It needs node and nothing else — no docker, no
	@# .env, no network path to the box — and it never touches the box.
	@#
	@# WHY IT IS ONE COMMAND AND NOT SEVEN. Standing the board up locally was a
	@# recipe in CLAUDE.md: copy the server with the Secure flags stripped,
	@# export four variables, seed a data directory, start it, remember the
	@# port, open the browser, and delete the copy afterwards. Every one of
	@# those is a place to be one character out, and the last one was forgotten
	@# often enough that an empty server.nosec.mjs was once committed.
	@#
	@# WHY THE COPY WITH THE COOKIES CHANGED. A browser will not send a Secure
	@# cookie over plain http, so on localhost the signed-in paths cannot be
	@# walked at all — the room never loads and it reads as the feature being
	@# broken. The copy is generated per run, gitignored, and deleted on the
	@# way out, including on Ctrl-C.
	@#
	@# IT RUNS FROM board/ because server.js reads its pages from ./public. Run
	@# from the repo root it starts, answers, and 500s on every page.
	@#
	@# THE DATA IS A TEMP DIRECTORY that goes with it. Nothing typed into this
	@# survives the command, which is the point: it is a thing to look at, not
	@# a place to keep anything.
	@#
	@# THE TWO LINES IN THE ROOM GO IN THROUGH THE REAL ROUTE, after the server
	@# is up, rather than into the seed file. A message has a shape the seed
	@# would then have to know and keep in step with; /api/group/say already
	@# knows it.
	@#
	@# `exec` in the subshell so the thing the trap kills is node and not a
	@# shell holding node — otherwise Ctrl-C leaves the port occupied and the
	@# second run of this fails in a way that looks like the first one worked.
	@#
	@# TWO TRAPS, BECAUSE CTRL-C IS NOT AN ERROR. One trap on EXIT does the
	@# clearing up; a second on INT exits 0 so that pressing Ctrl-C — which is
	@# how this is meant to end — does not print "make: *** Error 130" under
	@# the goodbye.
	@command -v node >/dev/null || { \
	  echo "No node on this machine, and the board is a node program."; \
	  echo "Run it where you run 'make listing'."; exit 1; }
	@# IT WILL NOT RESET OVER UNCOMMITTED WORK, and that is not caution: the
	@# first version did, and ate an hour of edits to this very file the first
	@# time it was run on a machine that had any. A look at a page is never
	@# worth somebody's working tree.
	@#
	@# A FAILED FETCH MUST NOT STOP THE LOOK either, the same as app-state.
	@# GitHub over TLS times out from where Tom works, and a bad minute on that
	@# network is not a reason to be unable to open a page on this machine.
	@branch=$$(git rev-parse --abbrev-ref HEAD); \
	  if [ -n "$$(git status --porcelain)" ]; then \
	    echo "  (uncommitted changes here — showing them rather than fetching)"; \
	  elif git fetch origin "$$branch" -q 2>/dev/null; then \
	    git reset --hard -q "origin/$$branch"; echo "  fetched origin/$$branch"; \
	  else \
	    echo "  (could not reach GitHub — showing what is on this disk)"; \
	  fi
	@test -d board/node_modules || { \
	  echo "  installing what the board needs (once on this machine)"; \
	  npm install --prefix board --silent --no-audit --no-fund; }
	@set -e; \
	  dir=$$(mktemp -d); port=$${PORT:-8391}; salt=tryboard; room=bbbbbbbbbbbbbbbbbbbb; \
	  sed 's/; Secure//g' board/server.js > board/server.nosec.mjs; \
	  trap 'kill $$pid 2>/dev/null; rm -f board/server.nosec.mjs; rm -rf "$$dir"; \
	        echo; echo "  Stopped. Nothing was kept, and nothing was deployed."; echo' EXIT; \
	  trap 'exit 0' INT TERM; \
	  node scripts/try.mjs "$$dir" "$$salt"; \
	  ( cd board && exec env BOARD_DIR="$$dir" BOARD_SALT="$$salt" BOARD_INVITE=off PORT="$$port" \
	      BOARD_DEMO_DEVICE=sashadevice00001 \
	      BOARD_DEAL_FEE_TO="$${FEE_TO:-https://buy.stripe.com/example}" \
	      BOARD_PAY_DEMO=1 \
	      node server.nosec.mjs > "$$dir/board.log" 2>&1 ) & pid=$$!; \
	  for i in $$(seq 1 60); do \
	    curl -fsS -o /dev/null "http://127.0.0.1:$$port/groups" 2>/dev/null && break; \
	    sleep 0.25; \
	  done; \
	  curl -fsS -o /dev/null "http://127.0.0.1:$$port/groups" 2>/dev/null || { \
	    echo "  The board did not start:"; sed 's/^/    /' "$$dir/board.log"; exit 1; }; \
	  say() { curl -fsS -o /dev/null -X POST -H 'content-type: application/json' \
	    -d "{\"device\":\"$$1\",\"group\":\"$$room\",\"text\":\"$$2\"}" \
	    "http://127.0.0.1:$$port/api/group/say" || true; }; \
	  say clairedevice0001 "Read it. The 14th works — I have him on hold until Friday."; \
	  say tomdevice0000001 "Sasha, Claire. Terms are at the top. Both of you tap Agree and I will get out of the way."; \
	  url="http://127.0.0.1:$$port/groups"; \
	  (command -v open >/dev/null && open "$$url" 2>/dev/null) \
	    || (command -v xdg-open >/dev/null && xdg-open "$$url" 2>/dev/null) \
	    || true; \
	  echo "  $$url"; \
	  echo; \
	  echo "  Tap Macau, March, then Pay on the balance. Ctrl-C when you have seen enough."; \
	  echo; \
	  wait $$pid

try-china: ## Walk the whole China Business Solutions widget on THIS machine: make try-china
	@# NOT `china`, WHICH IS TAKEN — that one builds the static site the
	@# mainland domain serves for the filing, from china/ at the repo root.
	@# This is board/china, the merchant widget, and it is named after `try`
	@# because it is the same kind of thing: stand it up here, look at it,
	@# Ctrl-C.
	@# THE SAME MACHINERY AS `try`, POINTED AT THE OTHER PRODUCT. It needs node
	@# and nothing else — no docker, no .env, no Stripe key, no network path to
	@# the box — and it never touches the box.
	@#
	@# WHY IT IS ITS OWN TARGET AND NOT A FLAG ON `try`. They open on different
	@# screens and stand for different things: `try` is a room with two people
	@# talking in it, this is a stranger deciding whether to take money through
	@# us. Sharing one command would mean a flag to remember, and a flag to
	@# remember is the step that gets left off.
	@#
	@# BOARD_PAY_DEMO=1 IS WHAT MAKES IT WALKABLE. Without a key the first
	@# button answers "payments are not switched on here yet" and the five
	@# screens behind it can only be reached by typing their addresses one at a
	@# time — which is looking at pictures, not walking through anything, and is
	@# how a dead link between two of them survives. In demo the trip to Stripe
	@# lands on a stand-in that says on itself that it is one. Nothing here can
	@# take money: there is no key behind it and no account to take money into.
	@#
	@# BOARD_INVITE=read, WHICH IS WHAT THE BOX RUNS. It was `off` here, and
	@# `off` opens every path — so /china missing from OPEN_PATHS passed every
	@# local test and served the door to everybody on the box. A local run set
	@# up more permissively than the real one is a local run that agrees with
	@# you.
	@command -v node >/dev/null || { \
	  echo "No node on this machine, and the board is a node program."; \
	  echo "Run it where you run 'make listing'."; exit 1; }
	@branch=$$(git rev-parse --abbrev-ref HEAD); \
	  if [ -n "$$(git status --porcelain)" ]; then \
	    echo "  (uncommitted changes here — showing them rather than fetching)"; \
	  elif git fetch origin "$$branch" -q 2>/dev/null; then \
	    git reset --hard -q "origin/$$branch"; echo "  fetched origin/$$branch"; \
	  else \
	    echo "  (could not reach GitHub — showing what is on this disk)"; \
	  fi
	@test -d board/node_modules || { \
	  echo "  installing what the board needs (once on this machine)"; \
	  npm install --prefix board --silent --no-audit --no-fund; }
	@set -e; \
	  dir=$$(mktemp -d); port=$${PORT:-8392}; \
	  sed 's/; Secure//g' board/server.js > board/server.nosec.mjs; \
	  trap 'kill $$pid 2>/dev/null; rm -f board/server.nosec.mjs; rm -rf "$$dir"; \
	        echo; echo "  Stopped. Nothing was kept, and nothing was deployed."; echo' EXIT; \
	  trap 'exit 0' INT TERM; \
	  ( cd board && exec env BOARD_DIR="$$dir" BOARD_SALT=china BOARD_INVITE=read PORT="$$port" \
	      BOARD_PAY_DEMO=1 \
	      node server.nosec.mjs > "$$dir/board.log" 2>&1 ) & pid=$$!; \
	  for i in $$(seq 1 60); do \
	    curl -fsS -o /dev/null "http://127.0.0.1:$$port/china/home.html" 2>/dev/null && break; \
	    sleep 0.25; \
	  done; \
	  curl -fsS -o /dev/null "http://127.0.0.1:$$port/china/home.html" 2>/dev/null || { \
	    echo "  It did not start:"; sed 's/^/    /' "$$dir/board.log"; exit 1; }; \
	  url="http://127.0.0.1:$$port/china/home.html"; \
	  (command -v open >/dev/null && open "$$url" 2>/dev/null) \
	    || (command -v xdg-open >/dev/null && xdg-open "$$url" 2>/dev/null) \
	    || true; \
	  echo "  $$url"; \
	  echo; \
	  echo "  Either button. Both doors, the stand-in for Stripe, and the page"; \
	  echo "  their client opens. Ctrl-C when you have seen enough."; \
	  echo; \
	  wait $$pid

app-ship: ## Build the app and hand it to Apple, from your Mac: make app-ship
	@# THE STEP THAT WAS STILL A SCREEN. Everything either side of it is one
	@# command already — the listing through the API, the reviewer's board,
	@# asking Apple where the app is — and the archive in the middle was seven
	@# steps in Xcode. Seven steps is the shape of thing that does not happen.
	@#
	@# It makes the iOS project the first time, syncs it every time after,
	@# archives, exports and uploads. The key is the same .p8 in
	@# ~/.appstoreconnect that app-state reads; nothing signs in to anything.
	@#
	@# OPEN=1 stops once the project exists and opens Xcode, for the first run
	@# or any run where something needs looking at. BUILD= and VERSION=
	@# override the numbers, TEAM= the team read off the keychain.
	@#
	@# It cannot do the age rating, two App Information sections or the
	@# screenshots — those are a web form, and app/store/FILL-IN.md lists them
	@# in the order the site asks.
	@bash scripts/app-ship.sh

app-state: ## Is the app submitted? Ask Apple, from your Mac:  make app-state
	@# THE ANSWER TO A QUESTION THAT OTHERWISE LIVES ON A SCREEN. App Store
	@# Connect knows whether the app is submitted; a screen is the one place
	@# that answer is no use here, because it cannot be read out, pasted back,
	@# or checked by the machine that did the work.
	@#
	@# Reads only. Safe at any point, including mid-review.
	@#
	@# Runs on the Mac for the same reason `listing` does: the .p8 lives there
	@# and a key that travelled to the box would be a key in a chat log.
	@#
	@# IT FETCHES FIRST, like `listing`, so that asking the question is one
	@# command rather than two — and so the answer is never given by a copy of
	@# this script that is a week old.
	@#
	@# BUT A FAILED FETCH MUST NOT STOP THE ANSWER, and the first version of
	@# this got that wrong. GitHub over TLS times out from where Tom works,
	@# often; Apple's API does not. Making the question depend on reaching
	@# GitHub meant a bad minute on one network swallowed a question about a
	@# different one — `SSL connection timeout`, Error 128, and nothing about
	@# the app. So the fetch is tried, and if it cannot be had we say so and
	@# ask Apple anyway with whatever is on this disk.
	@branch=$$(git rev-parse --abbrev-ref HEAD); \
	  if git fetch origin "$$branch" -q 2>/dev/null; then \
	    git reset --hard -q "origin/$$branch"; \
	  else \
	    echo "  (could not reach GitHub — asking Apple with the copy on this disk)"; \
	  fi
	@node app/store/state.mjs

listing: ## Fill in the App Store listing from your Mac:  make listing PHONE="<your number>"
	@# THE ONLY TARGET IN HERE THAT RUNS ON THE LAPTOP AND NOT THE SERVER.
	@#
	@# The App Store Connect key is a .p8 in ~/.appstoreconnect on the Mac and
	@# that is where it should stay: the box has no business holding a key that
	@# can publish an app, and a key that travelled to the box would have had to
	@# travel through something first.
	@#
	@# It fetches before it runs, because the alternative is two commands and
	@# the second one silently sending last week's words. reset --hard rather
	@# than pull for the reason written over 'deploy' — and it is safe on this
	@# checkout because the only thing here that is not in git is ios/, which
	@# Xcode owns and reset does not touch.
	@test -n "$(PHONE)" || { \
	  echo 'App Review needs a phone number — they ring it if they cannot get in.'; \
	  echo '  make listing PHONE="<your number>"'; exit 1; }
	@test -d ~/.appstoreconnect/private_keys || { \
	  echo "No App Store Connect key on this machine, so this is not the Mac."; \
	  echo "Run it where Xcode is."; exit 1; }
	@branch=$$(git rev-parse --abbrev-ref HEAD); \
	  git fetch origin "$$branch" -q && git reset --hard -q "origin/$$branch"
	@node app/store/fill-listing.mjs --phone "$(PHONE)"

claire-key: ## Make the key the ClaireTv partner console opens with: make claire-key
	@# WHY A TARGET AND NOT "PICK A PASSWORD". The console's whole door is this
	@# one string, it is typed once and then lives in a browser's session
	@# storage, and nobody ever has to remember it — so there is no reason for
	@# it to be short enough to remember, and every reason for it not to be.
	@#
	@# Printed rather than written into .env, because .env is on the box and
	@# this may be run anywhere. The line to paste is printed under it.
	@key=$$(head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 40); 	  echo ""; 	  echo "  Add this line to .env on the box, then deploy:"; 	  echo ""; 	  echo "    TOMSCODING_CLAIRE_PARTNER_KEY=$$key"; 	  echo ""; 	  echo "  Give the same string to whoever runs the catalogue. It is the"; 	  echo "  only thing standing between them and /partner."; 	  echo ""

claire-count: ## What ClaireTv has: make claire-count
	@$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" \
	  --entrypoint node claire /seed/claire-count.mjs

claire-seed: ## Put the demo series into ClaireTv: make claire-seed [SEED=claire/seed/wife-he-hired.json]
	@# A demo needs a catalogue that already looks like a catalogue. Typing ten
	@# episodes into a form to show somebody a product is the part of the demo
	@# where they stop watching.
	@$(COMPOSE) run --rm --no-deps -T \
	  -v "$(CURDIR)/scripts:/seed:ro" -v "$(CURDIR)/claire/seed:/series:ro" \
	  --entrypoint node claire /seed/claire-seed.mjs \
	  "/series/$(notdir $(or $(SEED),wife-he-hired.json))" /data/claire.json
	@$(COMPOSE) run --rm --no-deps -T \
	  -v "$(CURDIR)/scripts:/seed:ro" -v "$(CURDIR)/claire/seed:/series:ro" \
	  --entrypoint node claire /seed/claire-seed.mjs /series/coming-soon.json /data/claire.json

claire-video: ## Shoot the episodes with Seedance: make claire-video [GO=1] [ONLY=2,5] [SERIES="..."]
	@# Costs real money per second, so it says what it would shoot and stops
	@# unless GO=1. Anything that fails keeps its empty url, so running it again
	@# picks up exactly those.
	@$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" \
	  -e CLAIRE_PUBLIC="https://$$(sed -n 's/^TOMSCODING_CLAIRE_DOMAIN=//p' .env | tail -1)" \
	  --entrypoint node claire /seed/claire-video.mjs "$(or $(SERIES),The Wife He Hired)" $(if $(GO),--go,) $(if $(ONLY),--only=$(ONLY),) $(if $(GAPS),--gaps,)
	@# The server keeps the catalogue in memory, so new film is invisible until
	@# it restarts. Seconds of downtime, against an app that shows nothing new.
	@$(COMPOSE) restart claire >/dev/null && echo "  claire restarted, so the app shows it." 

china: ## Build the site the China domain serves, and look at it: make china
	@# RUNS WHEREVER NODE IS. No docker, no .env, nothing on the box — china/ is
	@# five static files and a stylesheet, and the mainland server that will
	@# serve them does not exist yet.
	@#
	@# BUILT FROM board/public/i18n.js, so the nine house rules and what the
	@# board keeps cannot drift from what the board itself says. A filing
	@# describes a website; the website has to stay the one described.
	@#
	@# It opens the browser because nothing else consumes china/ yet, so a
	@# build nobody looks at is a build nobody checks. Ctrl-C stops it.
	@command -v node >/dev/null || { \
	  echo "No node on this machine, and the build is a node program."; exit 1; }
	@set -e; \
	  trap 'kill $$pid 2>/dev/null; echo; echo "  Stopped."; echo' EXIT; \
	  trap 'exit 0' INT TERM; \
	  node scripts/china-build.mjs --look & pid=$$!; \
	  sleep 1; \
	  url="http://127.0.0.1:$${PORT:-8390}/"; \
	  (command -v open >/dev/null && open "$$url" 2>/dev/null) \
	    || (command -v xdg-open >/dev/null && xdg-open "$$url" 2>/dev/null) \
	    || true; \
	  wait $$pid

claire-episodes: ## Seed and shoot the ten full episodes: make claire-episodes GO=1
	@# THE TWO COMMANDS THAT ALWAYS GO TOGETHER. The seed carries the shot list
	@# and the shooter reads it from the catalogue, so a shot reworded in the
	@# seed and not reseeded is a shot the shooter never hears about — and the
	@# run looks like it worked.
	@#
	@# WITHOUT GO=1 it seeds and then says what it would shoot, which is also
	@# the run that makes the stills. With GO=1 it spends real money: ninety
	@# ten-second shots, four at a time, joined into ten episodes. Half an hour
	@# or so, and it is resumable by content — if it dies, or a shot is
	@# refused, run exactly this again and only what is missing is shot.
	@$(MAKE) --no-print-directory claire-seed
	@$(MAKE) --no-print-directory claire-video GO=$(GO)

deal: ## Pin the terms to a room: make deal ROOM=<id> HIRES="Claire" PROVIDES="Sasha" FEE="..." ...
	@# THE ONE PLACE IN HERE WHERE A NAME IS NOT A FIRST NAME. On the board a
	@# person is the handle they chose, so HIRES and PROVIDES are handles and
	@# `make who` is the only place that knows them. A wrong one fails with
	@# "not in that room", which is true and reads like the person is missing.
	@#
	@# Writing terms clears both agreements. There is no flag to keep them:
	@# "they agreed" has to mean they agreed to these words.
	@#
	@# ROOM comes from `make groups`. The room itself is made by
	@# `make group-invite WITH=... WHO=... FOR=...`, which mints the code and
	@# the room together.
	@test -n "$(ROOM)" || { echo 'Which room? `make groups` lists them.'; exit 1; }
	@test -n "$(HIRES)" -a -n "$(PROVIDES)" || { \
	  echo 'Both sides, by handle: make deal ROOM=... HIRES="Claire" PROVIDES="Sasha"'; exit 1; }
	@$(COMPOSE) run --rm --no-deps -T -v "$(CURDIR)/scripts:/seed:ro" \
	  -e ROOM="$(ROOM)" -e HIRES="$(HIRES)" -e PROVIDES="$(PROVIDES)" \
	  -e TITLE="$(TITLE)" -e WHAT="$(WHAT)" -e WHERE="$(WHERE)" -e WHEN="$(WHEN)" \
	  -e FEE="$(FEE)" -e DEPOSIT="$(DEPOSIT)" -e COVERS="$(COVERS)" -e CANCEL="$(CANCEL)" \
	  --entrypoint node board /seed/deal.mjs
