import { NextResponse } from "next/server";

import { apiGet } from "@/lib/api-client";
import { withAuth } from "@/lib/bff";

export interface ConversationDto {
  receiver: string;
  messages: ConversationMessageDto[];
}

export interface ConversationMessageDto {
  id: string;
  body: string;
  status: string;
  providerId?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

export const GET = withAuth(async (_request, token) => {
  const data = await apiGet<ConversationDto[]>("/messages", token);

  return NextResponse.json(data);
});
