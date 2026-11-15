import { z } from "zod";
import { InfraiClient } from "./infrai_client.ts";

export const resendRequest = z.object({
  messageId: z.string().min(1),
  idempotencyKey: z.string().min(1)
});

export type ResendRequest = z.infer<typeof resendRequest>;
export type ResendResult = { action: "resent" | "wait"; deliveryStatus: string };

export async function resendStuckCode(input: unknown, client: InfraiClient): Promise<ResendResult> {
  const request = resendRequest.parse(input);
  const event = await client.smsEvents(request.messageId);
  if (event.status !== "stuck") return { action: "wait", deliveryStatus: event.status };
  await client.smsResend(request.messageId, request.idempotencyKey);
  return { action: "resent", deliveryStatus: event.status };
}

if (process.argv[1]?.endsWith("resend_code.ts")) {
  const messageId = process.env.SMS_MESSAGE_ID;
  const idempotencyKey = process.env.SMS_RESEND_IDEMPOTENCY_KEY;
  if (!messageId || !idempotencyKey) throw new Error("SMS_MESSAGE_ID and SMS_RESEND_IDEMPOTENCY_KEY are required");
  const result = await resendStuckCode({ messageId, idempotencyKey }, new InfraiClient());
  console.log(JSON.stringify(result));
}
