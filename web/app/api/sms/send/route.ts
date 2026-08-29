import { NextResponse } from "next/server";

import { apiPost } from "@/lib/api-client";
import { withAuth } from "@/lib/bff";

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

export const POST = withAuth(async (request, token) => {
  const body: SendSmsRequest = await request.json();
  const data = await apiPost<SendSmsRequest, SendSmsResponse>(
    "/messages",
    body,
    token,
  );

  return NextResponse.json(data);
});
