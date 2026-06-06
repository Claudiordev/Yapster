import { NextResponse } from "next/server";

import { apiGet, ApiError } from "@/lib/api-client";
import { getAuthToken } from "@/lib/auth";

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

export async function GET() {
  try {
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    const data = await apiGet<ConversationDto[]>("/messages", token);

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
