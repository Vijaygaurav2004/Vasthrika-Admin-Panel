// types/order.ts
export interface Purchase {
  id: string;
  user_email: string;
  user_name: string;
  user_phone?: string;
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  color_name?: string;
  color_code?: string;
  order_id: string;
  razorpay_order_id: string;
  razorpay_payment_id?: string;
  purchase_date: string;
  status: string;
} 