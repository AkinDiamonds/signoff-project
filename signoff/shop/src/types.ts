/**
 * Domain types for the storefront client application.
 *
 * CRITICAL CONTRACT (Step 31):
 * - CartItem type strictly EXCLUDES any price field.
 *   The server alone computes prices from the official catalog.
 * - All money formatting is rendered via the shared <Money> component.
 */

import type { MoneyAmount } from '@signoff/ui';

export type { MoneyAmount };

export interface Product {
  sku: string;
  name: string;
  description: string;
  price: MoneyAmount;
}

/**
 * Line item stored in buyer cart.
 * Intentionally lacks any price property to prevent client-side tampering.
 */
export interface CartItem {
  sku: string;
  quantity: number;
}

export interface OrderItemRequest {
  sku: string;
  quantity: number;
}

export interface CreateOrderPayload {
  customer_email: string;
  items: OrderItemRequest[];
  demo_session_id?: string | null;
}

export interface CreateOrderResult {
  order_code: string;
  paypal_order_id: string;
  amount: MoneyAmount;
  status: string;
}

export interface CaptureOrderPayload {
  paypal_order_id?: string | null | undefined;
}

export interface CaptureOrderResult {
  order_code: string;
  paypal_transaction_id: string;
  status: string;
  carrier?: string | null;
  tracking_number?: string | null;
}

export interface OrderLineItem {
  sku: string;
  name: string;
  quantity: number;
  unit_price: string;
}

export interface TrackingMilestone {
  carrier: string;
  tracking_number: string;
  status: string;
  event_time: string;
  source?: 'simulated' | 'unknown';
}

export interface OrderDetail {
  order_code: string;
  status: string;
  customer_email: string;
  amount: MoneyAmount;
  items: OrderLineItem[];
  tracking_events: TrackingMilestone[];
  created_at: string;
  paypal_order_id?: string | null;
  paypal_capture_id?: string | null;
  shipment_source?: 'simulated' | 'unknown';
  shipment_mode?: string | null;
  next_shipping_event_at?: string | null;
}
