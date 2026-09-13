# @hark-protocol/protocol

Shared Zod schemas, taxonomy, tinybar helpers, and constants for [Hark
Protocol](https://github.com/SiddharthaMadhav/ETHOnline-2026) - an open
intent-advertising protocol with x402 machine payments on Hedera.

Publishers and advertising agents both build on these types: `Publisher`,
`Placement`, `HarkIntent`, `Campaign`, `HarkOpportunity`, `Delivery`, and the
`POST /v1/reach` request/response shapes, plus a small canonical topic
taxonomy (`isSameOrDescendant`, `topicDistance`).

```ts
import { createIntentInputSchema, isSameOrDescendant } from "@hark-protocol/protocol";
```

An optional `@hark-protocol/protocol/hcs14` subpath computes a
syntactically-valid HCS-14 "Universal Agent ID" - server-only (uses
`node:crypto`), kept out of the main browser-safe barrel on purpose.

Part of the [Hark Protocol](https://github.com/SiddharthaMadhav/ETHOnline-2026)
monorepo. See that repo for the full protocol spec, API, and demo apps.
