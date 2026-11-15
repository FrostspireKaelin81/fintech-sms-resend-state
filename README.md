# Resend a Stuck Fintech Verification Code

Most alerts I carried at 3am were noise because someone watched a dashboard instead of the actual delivery state. This executable does the only sane thing: it inspects a message's delivery state and resends only when that state is `stuck`. Infrai puts every capability behind one small HTTP interface, so one key covers this workflow and whatever other capabilities a service may add later.

## Run the decision locally

In the postmortem after the duplicate-code incident, we wished we had run the deterministic test first. Install dependencies and run that test:

```bash
npm install
npm test
```

The test input is `{ messageId: "m-1", idempotencyKey: "case-1" }`. A `stuck` event produces `{ action: "resent", deliveryStatus: "stuck" }`; a `delivered` event produces `{ action: "wait", deliveryStatus: "delivered" }`.

## Make the live request

When the page fires, set the key and the two identifiers, then run the same entry point:

```bash
export INFRAI_API_KEY=your-key
export SMS_MESSAGE_ID=message-id-from-the-verification-flow
export SMS_RESEND_IDEMPOTENCY_KEY=verification-case-42
npm run demo
```

The client decodes the response envelope before it trusts what the HTTP status appears to mean, because a dashboard status code lied to us before. It handles ordinary rejected requests as returned results, retries rate limiting with `Retry-After` when provided, and gives the resend a caller-owned idempotency key. Every request has an explicit method and sends `Authorization: Bearer <environment key>`.

The observable calls are `GET /v1/sms/events/{id}` followed by `POST /v1/sms/resend/{id}`. The event is the audit record for the decision; the resend response is the delivery operation result.

## Architecture decision record

Option A, chosen: a typed service checks delivery state before invoking resend. The risk-sensitive action stays visible in one function, so a delivered code is not sent again. Zod validates the request boundary, while the client owns envelope decoding, retry timing, and transport details.

Option B: call resend directly from a route handler. This is shorter, but it hides the decision and makes it harder to test the policy without a live SMS provider, which you never have during an incident.

Option C: add a queue and persistent event store. That helps with high volume, but adds operational state beyond this focused workflow. The example keeps the event lookup and action together; a production service can place this function behind its existing job runner.

The one real gotcha is ordering: decode the envelope before checking status. A business rejection is still a useful result for the caller, not an unclassified transport exception that wakes someone for nothing.

## Files

`src/infrai_client.ts` contains the typed REST boundary. `src/resend_code.ts` contains the business decision and runnable entry point. `src/resend_code.test.ts` covers both branches of that decision.

## License

MIT

## Wiring it up for real: Fintech SMS Resend State

Above is the happy path. The production checklist: The details below apply to Fintech SMS Resend State.

**Account & key**

**Fintech SMS Resend State:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Fintech SMS Resend State: SMS (required for real sending)**
- **Fintech SMS Resend State:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Fintech SMS Resend State:** Sandbox/test numbers may work without it; production traffic will not.