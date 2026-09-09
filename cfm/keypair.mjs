// A throwaway Stellar account for anchoring seals.
//
// It lives here rather than in scripts/ because scripts/ is mounted into the
// container from outside, where node cannot resolve the app's dependencies.
// This file sits beside them.
//
// It prints and stores nothing. The only copy of the secret that should exist
// after this runs is the one you paste into .env — not a shell history entry,
// not a screenshot, not a message. It is a spending key: fund the account with
// the few lumens the fees need and keep nothing else in it.

import { Keypair } from "@stellar/stellar-sdk";

const k = Keypair.random();
console.log("");
console.log("  PUBLIC   " + k.publicKey());
console.log("  SECRET   " + k.secret());
console.log("");
console.log("  In .env on this box, and nowhere else:");
console.log("");
console.log("    TOMSCODING_CFM_STELLAR_SECRET=" + k.secret().slice(0, 4) + "…");
console.log("    TOMSCODING_CFM_STELLAR_NET=test");
console.log("");
console.log("  Then: make up && make cfm-anchoring");
console.log("");
