declare module "mailparser" {
  export function simpleParser(
    source: string | Buffer | Uint8Array,
    options?: Record<string, unknown>
  ): Promise<{
    messageId?: string;
    date?: Date;
    subject?: string;
    text?: string;
    html?: string | false;
    from?: { text?: string };
  }>;
}
