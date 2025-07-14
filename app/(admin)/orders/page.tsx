import OrderManager from "@/components/admin/order-manager";

export default function OrdersPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">User Purchases</h1>
      <p className="mb-6 text-gray-600">View and manage all user purchases from the store.</p>
      <OrderManager />
    </div>
  );
} 