import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getGoogleClient } from "@/lib/google";
import { prisma } from "@/lib/prisma";
import { isBookioEmail, parseBookioEmail } from "@/lib/bookio";
import { generateReport } from "@/lib/report";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function extractBody(payload: any): string {
  if (!payload) return "";

  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  for (const part of payload.parts ?? []) {
    const result = extractBody(part);

    if (result) {
      return result;
    }
  }

  return "";
}

function header(payload: any, name: string) {
  return payload.headers?.find(
    (item: { name?: string; value?: string }) => item.name?.toLowerCase() === name.toLowerCase()
  )?.value;
}

function createRawEmail(to: string, subject: string, body: string) {
  return Buffer.from(
    [
      `To: ${to}`,
      `Subject: ${subject}`,
      "Content-Type: text/plain; charset=UTF-8",
      "",
      body
    ].join("\r\n")
  ).toString("base64url");
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "google_refresh_token" }
    });

    if (!setting) {
      return NextResponse.json({ error: "Gmail is not connected" }, { status: 400 });
    }

    const auth = getGoogleClient();
    auth.setCredentials({ refresh_token: setting.value });

    const gmail = google.gmail({ version: "v1", auth });
    let pageToken: string | undefined;
    let imported = 0;
    let ignored = 0;

    do {
      const list = await gmail.users.messages.list({
        userId: "me",
        q: "newer_than:2d",
        maxResults: 100,
        pageToken
      });

      for (const item of list.data.messages ?? []) {
        if (!item.id) continue;

        const exists = await prisma.emailMessage.findUnique({
          where: { id: item.id }
        });

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

        if (!isBookioEmail(sender, subject)) {
          ignored += 1;
          continue;
        }

        const receivedAt = message.data.internalDate
          ? new Date(Number(message.data.internalDate))
          : new Date();

        const parsed = parseBookioEmail(subject ?? "", body);

        await prisma.emailMessage.create({
          data: {
            id: item.id,
            threadId: message.data.threadId,
            receivedAt,
            sender,
            subject,
            snippet: message.data.snippet,
            body,
            reservation: {
              create: {
                customerName: parsed.customerName,
                customerEmail: parsed.customerEmail,
                customerPhone: parsed.customerPhone,
                service: parsed.service,
                dateTime: parsed.dateTime,
                status: parsed.status,
                rawSubject: subject
              }
            }
          }
        });

        imported += 1;
      }

      pageToken = list.data.nextPageToken ?? undefined;
    } while (pageToken);

    const { report, counts } = await generateReport(48);

    const reportTo = process.env.REPORT_TO_EMAIL;

    if (reportTo) {
      await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: createRawEmail(reportTo, report.subject, report.body)
        }
      });

      await prisma.report.update({
        where: { id: report.id },
        data: { emailSentAt: new Date() }
      });
    }

    return NextResponse.json({
      ok: true,
      imported,
      ignored,
      counts,
      reportId: report.id,
      emailSent: Boolean(reportTo)
    });
  } catch (error) {
    console.error("Bookio cron failed", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}