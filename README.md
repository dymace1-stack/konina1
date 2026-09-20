# Bookio Reservation Agent

Osobní agent pro sledování Bookio rezervací. Agent kontroluje schránku Seznam, ukládá Bookio notifikace do PostgreSQL a každé 2 dny odešle report.

## Jak to funguje

Seznam IMAP → Bookio filtr → parser → PostgreSQL → report → Seznam SMTP

Schránka používaná projektem:

`matej.cisteauto@seznam.cz`

Seznam používá pro IMAP server `imap.seznam.cz:993` přes SSL/TLS a pro SMTP server `smtp.seznam.cz:465` přes SSL/TLS.

## Stack

- Next.js + TypeScript
- Prisma + PostgreSQL
- ImapFlow + MailParser
- Seznam IMAP/SMTP
- Vercel Cron

## Lokální spuštění

1. Nainstaluj Node.js 20+.
2. Nainstaluj závislosti:

```bash
npm install
```

3. Nastav environment variables.
4. Inicializuj databázi:

```bash
npx prisma db push
```

5. Spusť aplikaci:

```bash
npm run dev
```

## Environment variables

Povinné:

```env
DATABASE_URL="postgresql://..."
SEZNAM_EMAIL="matej.cisteauto@seznam.cz"
SEZNAM_EMAIL_PASSWORD="..."
REPORT_TO_EMAIL="matej.cisteauto@seznam.cz"
CRON_SECRET="dlouhy-nahodny-secret"
BOOKIO_SENDER_EMAIL="..."
```

Volitelné:

```env
SEZNAM_IMAP_HOST="imap.seznam.cz"
SEZNAM_IMAP_PORT="993"
SEZNAM_SMTP_HOST="smtp.seznam.cz"
SEZNAM_SMTP_PORT="465"
```

Pokud máš na Seznamu zapnuté dvoufázové ověření, pro IMAP/SMTP musíš použít speciální heslo pro poštovní klienty, nikoli běžné heslo k účtu.

## Vercel

Projekt je připravený pro Vercel.

1. Importuj GitHub repo `dymace1-stack/konina1`.
2. Přidej všechny environment variables z předchozí sekce.
3. Deploy.
4. Po deployi můžeš ručně otestovat endpoint:

```bash
curl -H "Authorization: Bearer TVUJ_CRON_SECRET" https://TVUJ-DOMEN.vercel.app/api/cron/report
```

Cron je definovaný ve `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/report",
      "schedule": "0 8 */2 * *"
    }
  ]
}
```

Tento cron běží v 08:00 UTC každý druhý kalendářní den podle pole dne v měsíci. Není to přesně 48 hodin od předchozího běhu.

## Bezpečnost

- Endpoint `/api/cron/report` vyžaduje `CRON_SECRET`.
- Heslo Seznamu nikdy nedávej do GitHubu.
- Environment variables nastav pouze ve Vercelu.
- Pokud používáš 2FA na Seznamu, použij aplikační heslo pro IMAP/SMTP.

## Parser Bookio

Parser je heuristický a rozpoznává:

- novou rezervaci,
- změnu rezervace,
- zrušení rezervace,
- jméno,
- e-mail,
- telefon,
- službu,
- datum a čas.

Pro úplně přesné parsování je nejlepší dodat skutečný anonymizovaný Bookio e-mail. Pak lze regexy upravit přesně podle šablony.

## Databáze

Prisma ukládá:

- původní e-mail,
- Bookio rezervaci,
- stav rezervace,
- datum a čas rezervace,
- zákaznické údaje,
- reporty.

Gmail/OAuth část byla z projektu odstraněna, protože tento osobní projekt používá Seznam.

## API

### GET /api/cron/report

Načte Bookio e-maily za posledních 48 hodin, nové zprávy uloží do databáze, vytvoří report a pokud je nastaven `REPORT_TO_EMAIL`, odešle ho přes Seznam SMTP.

Ruční spuštění:

```http
GET /api/cron/report
Authorization: Bearer TVUJ_CRON_SECRET
```

## Stav MVP

Hotové:

- Seznam IMAP
- Seznam SMTP
- Bookio filtr
- parser rezervací
- ochrana proti duplicitám
- PostgreSQL + Prisma
- 48h report
- Vercel Cron
- dashboard
- CRON_SECRET
- Node.js runtime pro Vercel

Před ostrým provozem je ještě vhodné provést reálný `npm install && npm run build` a otestovat parser na skutečném Bookio e-mailu.
