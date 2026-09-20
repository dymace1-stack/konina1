import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isBookioEmail, parseBookioEmail } from "@/lib/bookio";
import { generateReport } from "@/lib/report";
import { fetchRecentEmails, sendEmail } from "@/lib/seznam";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const messages = await fetchRecentEmails(48);
    let imported = 0;
    let ignored = 0;

    for (const message of messages) {
      const exists = await prisma.emailMessage.findUnique({
        where: { id: message.id }
      });

      if (exists) continue;

      if (!isBookioEmail(message.sender, message.subject)) {
        ignored += 1;
        continue;
      }

      const parsed = parseBookioEmail(message.subject ?? "", message.body);

      await prisma.emailMessage.create({
        data: {
          id: message.id,
          threadId: message.threadId,
          receivedAt: message.receivedAt,
          sender: message.sender,
          subject: message.subject,
          snippet: message.snippet,
          body: message.body,
          processedAt: new Date(),
          reservation: {
            create: {
              customerName: parsed.customerName,
              customerEmail: parsed.customerEmail,
              customerPhone: parsed.customerPhone,
              service: parsed.service,
              dateTime: parsed.dateTime,
              status: parsed.status,
              rawSubject: message.subject
            }
          }
        }
      });

      imported += 1;
    }

    const { report, counts } = await generateReport(48);
    const reportTo = process.env.REPORT_TO_EMAIL;

    if (reportTo) {
      await sendEmail(reportTo, report.subject, report.body);

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
