import { NextResponse } from "next/server";
import { getGoogleClient } from "@/lib/google";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      return NextResponse.json({ error: `Google OAuth failed: ${error}` }, { status: 400 });
    }

    if (!code) {
      return NextResponse.json({ error: "Missing OAuth code" }, { status: 400 });
    }

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

    return NextResponse.redirect(new URL("/?connected=1", request.url));
  } catch (error) {
    console.error("Google OAuth callback failed", error);
    return NextResponse.json({ error: "Google OAuth connection failed" }, { status: 500 });
  }
}