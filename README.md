# Bookio Reservation Agent MVP

MVP pro Vercel: sleduje Gmail schránku, filtruje Bookio upozornění, ukládá rezervace do PostgreSQL a každé 2 dny vytvoří report.

Bookio potvrzuje, že pracovníci mohou dostávat e-mail při nové, změněné i zrušené rezervaci, takže e-mailové notifikace jsou vhodný vstup pro tento MVP. 

## Stack

- Next.js + TypeScript
- Prisma + PostgreSQL
- Gmail API + OAuth
- Vercel Cron
- Heuristický parser Bookio e-mailů

## Nasazení

1. Vytvoř PostgreSQL databázi (např. Neon/Supabase).
2. V Google Cloud vytvoř OAuth 2.0 Web Application.
3. Přidej redirect URI:
   https://TVUJ-DOMEN.vercel.app/api/auth/google/callback
4. Na Vercelu nastav:
   DATABASE_URL
   GOOGLE_CLIENT_ID
   GOOGLE_CLIENT_SECRET
   GOOGLE_REDIRECT_URI
   REPORT_TO_EMAIL
   CRON_SECRET
   BOOKIO_SENDER_EMAIL
5. Deploy repo na Vercel.
6. Otevři aplikaci a klikni na Připojit Gmail.
7. Dokonči Google OAuth.
8. Vercel Cron bude endpoint spouštět každé 2 dny v 08:00 UTC.

## Důležité

Parser je záměrně generický, protože přesný obsah Bookio e-mailů závisí na nastavení účtu. Pro produkční verzi je vhodné dodat 2–3 anonymizované Bookio e-maily a parser upravit přesně podle jejich šablony.

## API

GET /api/cron/report

Endpoint načte Bookio e-maily za poslední 2 dny, uloží nové rezervace, vytvoří report a pokud je nastaven REPORT_TO_EMAIL, odešle ho e-mailem.

Pro ruční spuštění s CRON_SECRET:

Authorization: Bearer TVUJ_SECRET
