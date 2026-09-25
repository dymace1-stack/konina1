import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { simpleParser } from "mailparser";

export type SeznamMessage = {
  id: string;
  threadId?: string;
  receivedAt: Date;
  sender?: string;
  subject?: string;
  snippet?: string;
  body: string;
};

function getConfig() {
  const user = process.env.SEZNAM_EMAIL;
  const password = process.env.SEZNAM_EMAIL_PASSWORD;

  if (!user || !password) {
    throw new Error("Missing SEZNAM_EMAIL or SEZNAM_EMAIL_PASSWORD");
  }

  return { user, password };
}

function getImapClient() {
  const { user, password } = getConfig();

  return new ImapFlow({
    host: process.env.SEZNAM_IMAP_HOST ?? "imap.seznam.cz",
    port: Number(process.env.SEZNAM_IMAP_PORT ?? "993"),
    secure: true,
    auth: { user, pass: password },
    logger: false
  });
}

export async function fetchRecentEmails(periodHours = 48) {
  const client = getImapClient();
  const messages: SeznamMessage[] = [];
  const since = new Date(Date.now() - periodHours * 60 * 60 * 1000);

  await client.connect();

  try {
    const lock = await client.getMailboxLock("INBOX");

    try {
      const uids = await client.search({ since }, { uid: true });

      if (uids.length === 0) return messages;

      const fetched = await client.fetchAll(
        uids,
        {
          uid: true,
          envelope: true,
          internalDate: true,
          source: true
        },
        { uid: true }
      );

      for (const message of fetched) {
        if (!message.source) continue;

        const parsed = await simpleParser(message.source);
        const sender = parsed.from?.text || undefined;
        const subject = parsed.subject || undefined;
        const htmlBody = typeof parsed.html === "string"
          ? parsed.html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
          : "";
        const body = parsed.text?.trim() || htmlBody;

        messages.push({
          id: parsed.messageId?.trim() || `seznam:${message.uid}`,
          receivedAt: message.internalDate ?? parsed.date ?? new Date(),
          sender,
          subject,
          snippet: body.slice(0, 300),
          body
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return messages;
}

export async function sendEmail(to: string, subject: string, body: string) {
  const { user, password } = getConfig();

  const transporter = nodemailer.createTransport({
    host: process.env.SEZNAM_SMTP_HOST ?? "smtp.seznam.cz",
    port: Number(process.env.SEZNAM_SMTP_PORT ?? "465"),
    secure: true,
    auth: { user, pass: password }
  });

  try {
    await transporter.sendMail({
      from: user,
      to,
      subject,
      text: body
    });
  } finally {
    transporter.close();
  }
}
