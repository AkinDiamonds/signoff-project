/**
 * API client methods for buyer portal dispute and communication endpoints.
 */

import { getApiBaseUrl } from '../config';
import type {
  BuyerDisputeDetail,
  CreateDisputePayload,
  DisputeMessage,
  DisputeOffer,
  MoneyAmount,
  OfferResponsePayload,
  OrderDisputeStatus,
  SendMessagePayload,
} from './types';

const BASE_URL = getApiBaseUrl();

class PortalApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = 'PortalApiError';
    this.status = status;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMoneyAmount(value: unknown): value is MoneyAmount {
  return (
    isRecord(value) &&
    typeof value.value === 'string' &&
    typeof value.currency_code === 'string'
  );
}

function isDisputeMessage(value: unknown): value is DisputeMessage {
  return (
    isRecord(value) &&
    typeof value.posted_by === 'string' &&
    typeof value.time_posted === 'string' &&
    typeof value.content === 'string'
  );
}

function isDisputeOffer(value: unknown): value is DisputeOffer {
  return isRecord(value) && typeof value.offer_type === 'string' && isMoneyAmount(value.amount);
}

function isBuyerDisputeDetail(value: unknown): value is BuyerDisputeDetail {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.status === 'string' &&
    typeof value.reason === 'string' &&
    isMoneyAmount(value.amount) &&
    typeof value.created_at === 'string' &&
    Array.isArray(value.messages) &&
    value.messages.every(isDisputeMessage) &&
    (value.offer == null || isDisputeOffer(value.offer)) &&
    typeof value.order_code === 'string' &&
    typeof value.transaction_id === 'string'
  );
}

function isOrderDisputeStatus(value: unknown): value is OrderDisputeStatus {
  return (
    isRecord(value) &&
    typeof value.order_code === 'string' &&
    typeof value.dispute_eligible === 'boolean' &&
    typeof value.dispute_exists === 'boolean' &&
    (value.dispute == null || isBuyerDisputeDetail(value.dispute))
  );
}

function readErrorBody(body: unknown): { message: string | null; code: string | null } {
  if (!isRecord(body)) {
    return { message: null, code: null };
  }
  const error = isRecord(body.error) ? body.error : null;
  const message =
    error && typeof error.message === 'string'
      ? error.message
      : typeof body.detail === 'string'
        ? body.detail
        : typeof body.message === 'string'
          ? body.message
          : null;
  const code =
    error && typeof error.code === 'string'
      ? error.code
      : typeof body.code === 'string'
        ? body.code
        : null;
  return { message, code };
}

async function handleResponse<T>(
  res: Response,
  fallbackError: string,
  isExpectedBody: (value: unknown) => value is T
): Promise<T> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON response
  }

  if (!res.ok) {
    const { message, code } = readErrorBody(body);
    throw new PortalApiError(message ?? `${fallbackError} (HTTP ${res.status})`, res.status, code);
  }

  if (!isExpectedBody(body)) {
    throw new PortalApiError(
      'The server sent an unexpected response.',
      res.status,
      'INVALID_RESPONSE'
    );
  }

  return body;
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

  return handleResponse(res, 'Failed to fetch dispute status', isOrderDisputeStatus);
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

  return handleResponse(res, 'Failed to file dispute', isBuyerDisputeDetail);
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

  return handleResponse(res, 'Failed to send message', isBuyerDisputeDetail);
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

  return handleResponse(res, 'Failed to respond to offer', isBuyerDisputeDetail);
}
