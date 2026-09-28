# One person talking, many watching

Written for a session picking this up. What the board can do today, what each
step up costs, and the one thing that decides the answer.

## Today: one to one, and that is structural

`board/lib/call.js` keys every call on a PAIR:

    const pairKey = (a, b) => [a, b].sort().join("~");

One call, two device hashes, a queue each. There is no group-call code
anywhere in the repo — no room call, no broadcast, no SFU. The signalling is
a held-open poll (`/api/call/:who/poll`) and the media is plain WebRTC between
the two phones.

## The relay, and its ceiling

coturn on the same box, written fresh on every start by `relaySetup()`:

    max-bps=600000        600 kbps per allocation
    user-quota=4
    total-quota=200
    min-port=49210
    max-port=49250        41 ports — the real ceiling

Forty-one relay ports is forty-one relayed streams for the WHOLE board at
once. It only bites when the two ends cannot reach each other directly, which
on Chinese mobile networks is often. `make call-check` says whether the relay
is up at all.

## Three ways up, and what each costs

**Mesh — 3 to 6 watchers.** The broadcaster opens one peer connection per
watcher and uploads the stream that many times. 600 kbps each against a
phone's uplink: five watchers is 3 Mbps up and a hot phone. The change is to
the call map — a room instead of a pair, an offer per joiner — and the rest of
the stack is untouched. Days, not weeks. This is the only option that needs no
new server.

**SFU — 20 to 200 watchers.** The broadcaster uploads once, a media server
fans it out. mediasoup, LiveKit or Janus. It does not transcode, so the CPU is
modest, but the egress is not: 100 watchers at 600 kbps is 60 Mbps sustained
out of one Tokyo VPS. The box already runs eight containers and its ssh dies
under a build, so this wants its own machine. Sub-second latency and it still
feels like a call. A week plus ops.

**HLS or LL-HLS — thousands.** Ingest, package, hand to a CDN. Latency 3-15s,
or 2-5s with low-latency HLS, so it stops being a conversation and becomes a
broadcast; chat stays on the board beside it. Cheapest per watcher by a long
way at scale, and a monthly bill.

## The thing that actually decides it

**The watchers are in China and the box is in Tokyo.** Mesh and SFU both push
every stream across that border in real time — the exact problem this product
exists to route around. HLS with a CDN that has China coverage is the only one
of the three where the bytes come from near the watcher.

So: a handful of people in a room, mesh. A room of fifty, SFU on its own box,
and expect the border to be the quality story. A real audience, HLS and a CDN,
and accept that it is no longer a call.

## Where the code is

    board/lib/call.js        pairKey, CALLS, ring/poll/send, iceServers, relaySetup
    board/server.js          /api/call/:who/{ring,answer,bye,send,poll}
    board/public/notes.html  callShow, callLoop, callIn, callMedia — the layer over the chat
    Makefile                 make call-check — relay configured, up, answering
