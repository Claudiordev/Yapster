import { NextResponse } from "next/server";

import { apiPost, ApiError } from "@/lib/api-client";
import { getAuthToken } from "@/lib/auth";

interface SendSmsRequest {
  receiver: string;
  message: string;
}

interface SendSmsResponse {
  providerId: string;
  status: string;
  price?: string | null;
  priceUnit?: string | null;
}

export async function POST(request: Request) {
  try {
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    const body: SendSmsRequest = await request.json();

    const data = await apiPost<SendSmsRequest, SendSmsResponse>(
      "/messages",
      body,
      token,
    );

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
