/**
 * API client methods for buyer portal dispute and communication endpoints.
 */

import { getApiBaseUrl } from '../config';
import type {
  BuyerDisputeDetail,
  CreateDisputePayload,
  OfferResponsePayload,
  OrderDisputeStatus,
  SendMessagePayload,
} from './types';

const BASE_URL = getApiBaseUrl();

async function handleResponse<T>(res: Response, fallbackError: string): Promise<T> {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON response
  }

  if (!res.ok) {
    const errorMsg =
      body?.error?.message ||
      body?.detail ||
      body?.message ||
      `${fallbackError} (HTTP ${res.status})`;
    const error = new Error(errorMsg);
    (error as any).status = res.status;
    (error as any).code = body?.error?.code || body?.code;
    throw error;
  }

  return body as T;
}

export async function fetchOrderDisputeStatus(
  orderCode: string,
  email: string
): Promise<OrderDisputeStatus> {
  const url = new URL(
    `${BASE_URL}/api/shop/orders/${encodeURIComponent(orderCode)}/dispute`
  );
  url.searchParams.set('email', email);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  return handleResponse<OrderDisputeStatus>(res, 'Failed to fetch dispute status');
}

export async function createDispute(
  orderCode: string,
  payload: CreateDisputePayload
): Promise<BuyerDisputeDetail> {
  const url = `${BASE_URL}/api/shop/orders/${encodeURIComponent(orderCode)}/dispute`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<BuyerDisputeDetail>(res, 'Failed to file dispute');
}

export async function sendBuyerMessage(
  orderCode: string,
  payload: SendMessagePayload
): Promise<BuyerDisputeDetail> {
  const url = `${BASE_URL}/api/shop/orders/${encodeURIComponent(orderCode)}/dispute/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<BuyerDisputeDetail>(res, 'Failed to send message');
}

export async function respondToOffer(
  orderCode: string,
  payload: OfferResponsePayload
): Promise<BuyerDisputeDetail> {
  const url = `${BASE_URL}/api/shop/orders/${encodeURIComponent(orderCode)}/dispute/offer-response`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<BuyerDisputeDetail>(res, 'Failed to respond to offer');
}
