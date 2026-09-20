import { prisma } from "./prisma";

export async function generateReport(periodHours = 48) {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - periodHours * 60 * 60 * 1000);

  const reservations = await prisma.reservation.findMany({
    where: {
      createdAt: { gte: periodStart, lte: periodEnd }
    },
    orderBy: { dateTime: "asc" }
  });

  const counts = reservations.reduce(
    (acc, reservation) => {
      acc.total += 1;
      if (reservation.status === "new") acc.new += 1;
      if (reservation.status === "changed") acc.changed += 1;
      if (reservation.status === "cancelled") acc.cancelled += 1;
      return acc;
    },
    { total: 0, new: 0, changed: 0, cancelled: 0 }
  );

  const lines = reservations.map((r) => {
    const when = r.dateTime
      ? r.dateTime.toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" })
      : "termín nerozpoznán";
    return `- ${when} | ${r.customerName ?? "Neznámý klient"} | ${r.service ?? "Služba neuvedena"} | ${r.status}`;
  });

  const subject = `Bookio report – ${periodStart.toLocaleDateString("cs-CZ")} až ${periodEnd.toLocaleDateString("cs-CZ")}`;
  const body = [
    "BOOKIO REPORT",
    "",
    `Období: ${periodStart.toLocaleString("cs-CZ")} – ${periodEnd.toLocaleString("cs-CZ")}`,
    `Celkem: ${counts.total}`,
    `Nové: ${counts.new}`,
    `Změněné: ${counts.changed}`,
    `Zrušené: ${counts.cancelled}`,
    "",
    "REZERVACE",
    ...(lines.length ? lines : ["- Za posledních 48 hodin nebyla nalezena žádná rezervace."])
  ].join("\n");

  const report = await prisma.report.create({
    data: { periodStart, periodEnd, subject, body }
  });

  return { report, counts };
}