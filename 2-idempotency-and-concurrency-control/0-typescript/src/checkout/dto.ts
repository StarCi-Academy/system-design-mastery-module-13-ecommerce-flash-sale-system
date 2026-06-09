// Request body for POST /api/checkout/order.
export interface CreateOrderDto {
  amount: string;
  sku: string;
}

// Canonical success response shape, shared by all four language implementations.
export interface OrderResult {
  orderId: string;
  status: string;
  amount: string;
  replayed: boolean;
}
