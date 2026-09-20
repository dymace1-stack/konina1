export type ParsedReservation = {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  service?: string;
  dateTime?: Date;
  status: "new" | "changed" | "cancelled" | "unknown";
};

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

function parseDateTime(text: string) {
  const match = text.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})[^\d]{1,8}(\d{1,2}):(\d{2})/);
  if (!match) return undefined;

  const [, day, month, yearRaw, hour, minute] = match;
  const year = yearRaw.length === 2 ? Number(`20${yearRaw}`) : Number(yearRaw);
  const date = new Date(year, Number(month) - 1, Number(day), Number(hour), Number(minute));

  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function parseBookioEmail(subject: string, body: string): ParsedReservation {
  const text = `${subject}\n${body}`;
  const normalized = text.toLowerCase();

  let status: ParsedReservation["status"] = "unknown";
  if (/zruš|zrus|cancel|storno/.test(normalized)) status = "cancelled";
  else if (/změn|zmen|reschedule|přesun|presun/.test(normalized)) status = "changed";
  else if (/nová rezervace|nova rezervace|new reservation|rezervace/.test(normalized)) status = "new";

  return {
    status,
    customerName: firstMatch(text, [
      /(?:jméno|jmeno|name|zákazník|zakaznik)\s*[:\-]\s*([^\n]+)/i
    ]),
    customerEmail: firstMatch(text, [
      /(?:e-?mail|email)\s*[:\-]\s*([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/i
    ]),
    customerPhone: firstMatch(text, [
      /(?:telefon|tel\.?|phone)\s*[:\-]\s*([+\d][\d\s().-]{7,})/i
    ]),
    service: firstMatch(text, [
      /(?:služba|sluzba|service|typ rezervace|typ rezervacie)\s*[:\-]\s*([^\n]+)/i
    ]),
    dateTime: parseDateTime(text)
  };
}

export function isBookioEmail(sender: string | undefined, subject: string | undefined) {
  const configuredSender = process.env.BOOKIO_SENDER_EMAIL?.toLowerCase();
  const source = `${sender ?? ""} ${subject ?? ""}`.toLowerCase();

  if (configuredSender && source.includes(configuredSender)) return true;
  return /bookio|rezervac|reservation/.test(source);
}