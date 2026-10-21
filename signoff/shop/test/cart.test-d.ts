import { describe, expectTypeOf, it } from 'vitest';
import type { MoneyAmount } from '@signoff/ui';
import type { CartItem, CreateOrderPayload, OrderItemRequest, Product } from '../src/types';

describe('Storefront Type Contracts (Step 31)', () => {
  it('CartItem type strictly excludes any price property', () => {
    // Valid CartItem has only sku and quantity
    const item: CartItem = { sku: 'CND-LAV-01', quantity: 2 };
    expectTypeOf(item.sku).toEqualTypeOf<string>();
    expectTypeOf(item.quantity).toEqualTypeOf<number>();

    // Assert that 'price' property is NOT a key of CartItem
    expectTypeOf<CartItem>().not.toHaveProperty('price');
    expectTypeOf<CartItem>().not.toHaveProperty('unit_price');
    expectTypeOf<CartItem>().not.toHaveProperty('amount');

    // @ts-expect-error - CartItem cannot be constructed with price
    const _invalidItem: CartItem = { sku: 'CND-LAV-01', quantity: 2, price: '21.00' };
    void _invalidItem;
  });

  it('OrderItemRequest strictly excludes price property', () => {
    expectTypeOf<OrderItemRequest>().not.toHaveProperty('price');
    expectTypeOf<OrderItemRequest>().not.toHaveProperty('unit_price');

    // @ts-expect-error - OrderItemRequest cannot contain price
    const _invalidOrderReq: OrderItemRequest = { sku: 'CND-LAV-01', quantity: 1, price: 21 };
    void _invalidOrderReq;
  });

  it('Product contains MoneyAmount for shared <Money> component rendering', () => {
    expectTypeOf<Product['price']>().toEqualTypeOf<MoneyAmount>();
    expectTypeOf<Product['price']['value']>().toEqualTypeOf<string>();
    expectTypeOf<Product['price']['currency_code']>().toEqualTypeOf<string>();
  });

  it('CreateOrderPayload enforces customer email and items without prices', () => {
    const payload: CreateOrderPayload = {
      customer_email: 'alex.morgan@example.test',
      items: [{ sku: 'CND-LAV-01', quantity: 2 }],
    };
    expectTypeOf(payload.items).toEqualTypeOf<OrderItemRequest[]>();
  });
});

