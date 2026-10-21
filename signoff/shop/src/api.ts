/**
 * API client wrapper for storefront endpoints.
 */

import { createApiClient } from '@signoff/api-client';
import type { paths } from '@signoff/api-client';
import { getApiBaseUrl } from './config';
import type {
  CaptureOrderPayload,
  CaptureOrderResult,
  CreateOrderPayload,
  CreateOrderResult,
  OrderDetail,
  Product,
} from './types';

const client = createApiClient({ baseUrl: getApiBaseUrl() });

const SESSION_STORAGE_KEY = 'signoff.demo.session';

export function getDemoSessionId(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setDemoSessionId(sessionId: string): void {
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } catch {
    // Storage restricted
  }
}

export async function fetchCatalog(): Promise<Product[]> {
  const res = await client.request<
    paths['/api/shop/catalog']['get']['responses']['200']['content']['application/json']
  >('/api/shop/catalog', { method: 'GET' });

  if (!res.success || !res.data) {
    const msg = res.error?.kind === 'api_envelope' ? res.error.error.message : (res.error?.message ?? 'Failed to load catalog');
    throw new Error(msg);
  }
  return res.data;
}

export async function fetchProduct(sku: string): Promise<Product> {
  const res = await client.request<
    paths['/api/shop/catalog/{sku}']['get']['responses']['200']['content']['application/json']
  >('/api/shop/catalog/{sku}', {
    method: 'GET',
    params: { path: { sku } },
  });

  if (!res.success || !res.data) {
    const msg = res.error?.kind === 'api_envelope' ? res.error.error.message : (res.error?.message ?? `Product ${sku} not found`);
    throw new Error(msg);
  }
  return res.data;
}

export async function createShopOrder(payload: CreateOrderPayload): Promise<CreateOrderResult> {
  const headers: Record<string, string> = {};
  const sessionId = payload.demo_session_id || getDemoSessionId();
  if (sessionId) {
    headers['X-Demo-Session'] = sessionId;
  }

  const res = await client.request<
    paths['/api/shop/orders']['post']['responses']['201']['content']['application/json']
  >('/api/shop/orders', {
    method: 'POST',
    body: {
      customer_email: payload.customer_email,
      items: payload.items,
      demo_session_id: sessionId ?? undefined,
    },
    headers,
  });

  if (!res.success || !res.data) {
    const msg = res.error?.kind === 'api_envelope' ? res.error.error.message : (res.error?.message ?? 'Order creation failed');
    throw new Error(msg);
  }
  return res.data;
}

export async function captureShopOrder(
  orderCode: string,
  payload?: CaptureOrderPayload
): Promise<CaptureOrderResult> {
  const res = await client.request<
    paths['/api/shop/orders/{order_code}/capture']['post']['responses']['200']['content']['application/json']
  >('/api/shop/orders/{order_code}/capture', {
    method: 'POST',
    params: { path: { order_code: orderCode } },
    body: payload?.paypal_order_id ? { paypal_order_id: payload.paypal_order_id } : {},
  });

  if (!res.success || !res.data) {
    const msg = res.error?.kind === 'api_envelope' ? res.error.error.message : (res.error?.message ?? 'Payment capture failed');
    throw new Error(msg);
  }
  return res.data;
}

export async function fetchOrderDetail(orderCode: string, email: string): Promise<OrderDetail> {
  const res = await client.request<
    paths['/api/shop/orders/{order_code}']['get']['responses']['200']['content']['application/json']
  >('/api/shop/orders/{order_code}', {
    method: 'GET',
    params: {
      path: { order_code: orderCode },
      query: { email },
    },
  });

  if (!res.success || !res.data) {
    const msg = res.error?.kind === 'api_envelope' ? res.error.error.message : (res.error?.message ?? 'Order not found');
    throw new Error(msg);
  }
  return res.data;
}
