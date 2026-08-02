import { NextResponse } from "next/server";

import { apiGet, apiPost } from "@/lib/api-client";
import { withAuth } from "@/lib/bff";
import type { ChatMessageDto } from "@/lib/chat";

type Ctx = { params: Promise<{ conversationId: string }> };

// History — newest-first, keyset by `seq` (?beforeSeq=&limit=).
export const GET = withAuth<Ctx>(async (request, token, { params }) => {
  const { conversationId } = await params;
  const { searchParams } = new URL(request.url);
  const qs = new URLSearchParams({ limit: searchParams.get("limit") ?? "20" });
  const beforeSeq = searchParams.get("beforeSeq");

  if (beforeSeq) qs.set("beforeSeq", beforeSeq);

  const data = await apiGet<ChatMessageDto[]>(
    `/chat/${conversationId}/message?${qs.toString()}`,
    token,
  );

  return NextResponse.json(data);
});

// Send a message.
export const POST = withAuth<Ctx>(async (request, token, { params }) => {
  const { conversationId } = await params;
  const body = (await request.json()) as { body: string };
  const data = await apiPost<{ body: string }, ChatMessageDto>(
    `/chat/${conversationId}/message`,
    body,
    token,
  );

  return NextResponse.json(data, { status: 201 });
});
