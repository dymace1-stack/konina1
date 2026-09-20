import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(date: Date | null) {
  if (!date) return "Termín nerozpoznán";

  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function statusLabel(status: string) {
  switch (status) {
    case "new":
      return "Nová";
    case "changed":
      return "Změněná";
    case "cancelled":
      return "Zrušená";
    default:
      return "Neznámý stav";
  }
}

export default async function Home() {
  try {
    const [reports, reservations, reservationCount, connection] = await Promise.all([
      prisma.report.findMany({
        orderBy: { generatedAt: "desc" },
        take: 5
      }),
      prisma.reservation.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { email: true }
      }),
      prisma.reservation.count(),
      prisma.appSetting.findUnique({
        where: { key: "google_refresh_token" },
        select: { key: true }
      })
    ]);

    return (
      <main>
        <header className="hero">
          <div>
            <p className="eyebrow">BOOKIO AGENT</p>
            <h1>Rezervace pod kontrolou.</h1>
            <p className="muted">
              Gmail → Bookio notifikace → databáze → report každých 48 hodin.
            </p>
          </div>
          <a className="button" href="/api/auth/google">
            {connection ? "Připojit Gmail znovu" : "Připojit Gmail"}
          </a>
        </header>

        <section className="stats">
          <div className="card stat">
            <span>Rezervace celkem</span>
            <strong>{reservationCount}</strong>
          </div>
          <div className="card stat">
            <span>Gmail</span>
            <strong>{connection ? "Připojen" : "Nepřipojen"}</strong>
          </div>
          <div className="card stat">
            <span>Reporty</span>
            <strong>{reports.length}</strong>
          </div>
        </section>

        <section className="card">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">AKTIVITA</p>
              <h2>Poslední rezervace</h2>
            </div>
          </div>

          {reservations.length === 0 ? (
            <p className="muted">Zatím žádné Bookio rezervace.</p>
          ) : (
            <div className="table">
              {reservations.map((reservation) => (
                <div className="row" key={reservation.id}>
                  <div>
                    <strong>{reservation.customerName ?? "Neznámý klient"}</strong>
                    <span>{reservation.service ?? "Služba neuvedena"}</span>
                  </div>
                  <div>
                    <strong>{formatDate(reservation.dateTime)}</strong>
                    <span>{statusLabel(reservation.status)}</span>
                  </div>
                  <div className="muted">{formatDate(reservation.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <p className="eyebrow">REPORTY</p>
          <h2>Poslední reporty</h2>
          {reports.length === 0 ? (
            <p className="muted">První report vznikne při běhu Vercel Cronu.</p>
          ) : (
            reports.map((report) => (
              <article className="report" key={report.id}>
                <div>
                  <strong>{report.subject}</strong>
                  <span>{formatDate(report.generatedAt)}</span>
                </div>
                <pre>{report.body}</pre>
              </article>
            ))
          )}
        </section>
      </main>
    );
  } catch (error) {
    console.error("Dashboard failed", error);

    return (
      <main>
        <section className="card">
          <h1>Bookio Agent</h1>
          <p>Databáze zatím není připojená nebo není inicializovaná.</p>
          <p className="muted">
            Nastav DATABASE_URL, spusť prisma db push a aplikaci znovu načti.
          </p>
        </section>
      </main>
    );
  }
}