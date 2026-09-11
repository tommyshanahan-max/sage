# The posting loop

    make gram                    make the stills, mark every fifth for a clip
    make deploy                  the pictures have to be on the open web first
    make gram-clips              the mp4s, via Seedance on ARK
    make gram-next               post the next one that has not gone out
    make gram-token              refresh the Instagram token

## Automating it

Three a day, on the box, as root:

    crontab -e

    0 2,7,12 * * *  cd /root/tc && make gram-next  >> /var/log/gram.log 2>&1
    0 4 1 * *       cd /root/tc && make gram-token >> /var/log/gram.log 2>&1

Those are UTC. 02:00, 07:00 and 12:00 UTC is 10:00, 15:00 and 20:00 in
Beijing — morning, afternoon and evening where the readers are.

The token line is monthly, and it matters: the token lasts sixty days and
nothing warns you before it stops.

## What runs out

`posted.json` is the record of what has gone. When everything in `out/` has
been posted, `gram-next` says so and does nothing — it will not post the same
card twice. Add pairs to `BUILTIN` in `make.mjs`, or pass a JSON file:

    make gram PAIRS=scripts/gram/pairs.json

## What is not automated, and will not be

WeChat and WhatsApp. Neither has an API for posting to Moments, groups or
status, and no amount of code changes that. Every caption file carries a third
block written for pasting into a chat by hand — see the note in `make.mjs`.
