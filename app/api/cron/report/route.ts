import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getGoogleClient } from "@/lib/google";
import { prisma } from "@/lib/prisma";
import { isBookioEmail, parseBookioEmail } from "@/lib/bookio";
import { generateReport } from "@/lib/report";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function extractBody(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  for (const part of payload.parts ?? []) {
    const result = extractBody(part);
    if (result) return result;
  }
  return "";
}

function header(payload: any, name: string) {
  return payload.headers?.find((item: any) => item.name?.toLowerCase() === name.toLowerCase())?.value;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: "google_refresh_token" } });
    if (!setting) return NextResponse.json({ error: "Gmail is not connected" }, { status: 400 });

    const auth = getGoogleClient();
    auth.setCredentials({ refresh_token: setting.value });

    const gmail = google.gmail({ version: "v1", auth });
    const list = await gmail.users.messages.list({
      userId: "me",
      q: "newer_than:2d",
      maxResults: 100
    });

    for (const item of list.data.messages ?? []) {
      if (!item.id) continue;

      const exists = await prisma.emailMessage.findUnique({ where: { id: item.id } });
      if (exists) continue;

      const message = await gmail.users.messages.get({
        userId: "me",
        id: item.id,
        format: "full"
      });

      const payload = message.data.payload;
      const sender = header(payload, "From");
      const subject = header(payload, "Subject");
      const body = extractBody(payload);

      if (!isBookioEmail(sender, subject)) continue;

      const receivedAt = message.data.internalDate
        ? new Date(Number(message.data.internalDate))
        : new Date();

      await prisma.emailMessage.create({
        data: {
          id: item.id,
          threadId: message.data.threadId,
          receivedAt,
          sender,
          subject,
          snippet: message.data.snippet,
          body
        }
      });

      const parsed = parseBookioEmail(subject ?? "", body);

      await prisma.reservation.create({
        data: {
          emailId: item.id,
          customerName: parsed.customerName,
          customerEmail: parsed.customerEmail,
          customerPhone: parsed.customerPhone,
          service: parsed.service,
          dateTime: parsed.dateTime,
          status: parsed.status,
          rawSubject: subject
        }
      });
    }

    const { report, counts } = await generateReport(48);

    const reportTo = process.env.REPORT_TO_EMAIL;
    if (reportTo) {
      await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: Buffer.from(
            [
              `To: ${reportTo}`,
              `Subject: ${report.subject}`,
              "Content-Type: text/plain; charset=UTF-8",
              "",
              report.body
            ].join("\r\n")
          ).toString("base64url")
        }
      });

      await prisma.report.update({
        where: { id: report.id },
        data: { emailSentAt: new Date() }
      });
    }

    return NextResponse.json({ ok: true, counts, reportId: report.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}