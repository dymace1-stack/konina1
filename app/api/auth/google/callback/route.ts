import { NextResponse } from "next/server";
import { getGoogleClient } from "@/lib/google";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Missing OAuth code" }, { status: 400 });

  const client = getGoogleClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    return NextResponse.json(
      { error: "Google did not return a refresh token. Revoke the app access and connect again." },
      { status: 400 }
    );
  }

  await prisma.appSetting.upsert({
    where: { key: "google_refresh_token" },
    update: { value: tokens.refresh_token },
    create: { key: "google_refresh_token", value: tokens.refresh_token }
  });

  return NextResponse.redirect(new URL("/", request.url));
}