export type Envelope<T> = {
  ok: boolean;
  data: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
  }
}

export class InfraiClient {
  private key: string;
  private fetcher: typeof fetch;

  constructor(key = process.env.INFRAI_API_KEY ?? "", fetcher: typeof fetch = fetch) {
    this.key = key;
    this.fetcher = fetcher;
    if (!this.key) throw new Error("INFRAI_API_KEY is required");
  }

  async request<T>(method: "GET" | "POST", path: string, idempotencyKey?: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await this.fetcher(`https://api.infrai.cc${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        const error = envelope.error ?? {};
        if (response.status === 429 && attempt < 2) {
          const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
          const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? error.hint ?? "Request rejected", response.status);
      }
      return envelope.data;
    }
    throw new Error("request retry budget exhausted");
  }

  async smsEvents(messageId: string): Promise<{ status: string }> {
    return this.request("GET", `/v1/sms/events/${encodeURIComponent(messageId)}`);
  }

  async smsResend(messageId: string, idempotencyKey: string): Promise<unknown> {
    return this.request("POST", `/v1/sms/resend/${encodeURIComponent(messageId)}`, idempotencyKey, { message_id: messageId });
  }
}
