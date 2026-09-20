import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  const reports = await prisma.report.findMany({
    orderBy: { generatedAt: "desc" },
    take: 5
  });

  const reservationCount = await prisma.reservation.count();

  return (
    <main>
      <h1>Bookio Agent</h1>
      <p className="muted">MVP pro kontrolu Bookio e-mailových upozornění a 48h reporty.</p>

      <div className="card">
        <h2>Stav</h2>
        <p>Uložené rezervace: <strong>{reservationCount}</strong></p>
        <p>
          <a className="button" href="/api/auth/google">Připojit Gmail</a>
        </p>
      </div>

      <div className="card">
        <h2>Poslední reporty</h2>
        {reports.length === 0 ? (
          <p className="muted">Zatím žádný report. Po připojení Gmailu spusť cron endpoint.</p>
        ) : (
          reports.map((report) => (
            <article key={report.id}>
              <h3>{report.subject}</h3>
              <pre>{report.body}</pre>
            </article>
          ))
        )}
      </div>
    </main>
  );
}