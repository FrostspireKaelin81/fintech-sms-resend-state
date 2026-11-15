import test from "node:test";
import assert from "node:assert/strict";
import { InfraiClient } from "./infrai_client.ts";
import { resendStuckCode } from "./resend_code.ts";

test("resends only a stuck verification message", async () => {
  const calls: string[] = [];
  const fetcher = async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push(`${init?.method} ${url.toString()}`);
    return new Response(JSON.stringify(init?.method === "GET"
      ? { ok: true, data: { status: "stuck" } }
      : { ok: true, data: { message_id: "m-1" } }), { status: 200 });
  };
  const result = await resendStuckCode({ messageId: "m-1", idempotencyKey: "case-1" }, new InfraiClient("test-key", fetcher));
  assert.deepEqual(result, { action: "resent", deliveryStatus: "stuck" });
  assert.deepEqual(calls.map((call) => call.split(" ")[0]), ["GET", "POST"]);
});

test("keeps a delivered message untouched", async () => {
  const fetcher = async () => new Response(JSON.stringify({ ok: true, data: { status: "delivered" } }), { status: 200 });
  const result = await resendStuckCode({ messageId: "m-2", idempotencyKey: "case-2" }, new InfraiClient("test-key", fetcher));
  assert.deepEqual(result, { action: "wait", deliveryStatus: "delivered" });
});
