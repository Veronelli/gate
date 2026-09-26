import { NextResponse } from "next/server";
import {
  deleteContact,
  getContact,
  unlinkTelegram,
  upsertContact,
} from "@/lib/server/contacts";
import { getSessionUser, unauthorized } from "@/lib/server/session";

const PHONE_RE = /^[+0-9][0-9 ()-]{5,24}$/;

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return unauthorized();
  const contact = await getContact(user.id);
  return NextResponse.json({ contact });
}

export async function PUT(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return unauthorized();
  const body = (await request.json()) as { phone?: string };
  const phone = body.phone?.trim() ?? "";
  if (!PHONE_RE.test(phone)) {
    return NextResponse.json(
      { error: "Número de teléfono inválido." },
      { status: 400 },
    );
  }
  const contact = await upsertContact(user.id, phone);
  return NextResponse.json({ contact });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return unauthorized();
  // ?scope=telegram → solo desvincula el chat; sin scope → borra el contact.
  const scope = new URL(request.url).searchParams.get("scope");
  if (scope === "telegram") await unlinkTelegram(user.id);
  else await deleteContact(user.id);
  return NextResponse.json({ ok: true });
}
