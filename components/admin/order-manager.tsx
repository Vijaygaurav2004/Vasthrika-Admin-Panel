"use client";

import { useState, useEffect } from "react";
import { getPurchases, updatePurchaseStatus, deletePurchase, deleteAllPurchases } from "@/lib/supabase/orders";
import { Purchase } from "@/types/order";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function OrderManager() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  
  useEffect(() => {
    async function loadPurchases() {
      try {
        setLoading(true);
        const data = await getPurchases();
        setPurchases(data);
      } catch (err) {
        setError("Failed to load purchases");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    
    loadPurchases();
  }, []);
  
  const handleStatusChange = async (purchaseId: string, newStatus: string) => {
    try {
      await updatePurchaseStatus(purchaseId, newStatus);
      
      // Update local state
      setPurchases(purchases.map(purchase => {
        if (purchase.id === purchaseId) {
          return {
            ...purchase,
            status: newStatus
          };
        }
        return purchase;
      }));
      
      // Update selected purchase if it's the one being modified
      if (selectedPurchase && selectedPurchase.id === purchaseId) {
        setSelectedPurchase({
          ...selectedPurchase,
          status: newStatus
        });
      }
    } catch (err) {
      console.error("Failed to update purchase status:", err);
      setError("Failed to update purchase status");
    }
  };
  
  const handleDeletePurchase = async (purchaseId: string) => {
    try {
      await deletePurchase(purchaseId);
      
      // Update local state by removing the deleted purchase
      setPurchases(purchases.filter(purchase => purchase.id !== purchaseId));
      
      // Close details dialog if the deleted purchase was selected
      if (selectedPurchase && selectedPurchase.id === purchaseId) {
        setIsDetailsOpen(false);
      }
    } catch (err) {
      console.error("Failed to delete purchase:", err);
      setError("Failed to delete purchase");
    }
  };
  
  const handleDeleteAllPurchases = async () => {
    if (confirm("Are you sure you want to delete all purchases? This action cannot be undone.")) {
      try {
        await deleteAllPurchases();
        setPurchases([]);
        setIsDetailsOpen(false);
      } catch (err) {
        console.error("Failed to delete all purchases:", err);
        setError("Failed to delete all purchases");
      }
    }
  };
  
  const viewPurchaseDetails = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setIsDetailsOpen(true);
  };
  
  const closeDetails = () => {
    setIsDetailsOpen(false);
  };
  
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500">Processing</Badge>;
      case 'completed':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };
  
  if (loading) {
    return <div className="flex justify-center p-8">Loading purchases...</div>;
  }
  
  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }
  
  // Group purchases by order_id
  const purchasesByOrder = purchases.reduce((acc, purchase) => {
    if (!acc[purchase.order_id]) {
      acc[purchase.order_id] = [];
    }
    acc[purchase.order_id].push(purchase);
    return acc;
  }, {} as Record<string, Purchase[]>);
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Customer Purchases</h2>
        {purchases.length > 0 && (
          <Button 
            variant="destructive" 
            onClick={handleDeleteAllPurchases}
          >
            Delete All
          </Button>
        )}
      </div>
      
      {purchases.length === 0 ? (
        <Card className="p-6">
          <p>No purchases found.</p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Purchase ID</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell>{purchase.id.substring(0, 8)}...</TableCell>
                  <TableCell>{purchase.order_id.substring(0, 8)}...</TableCell>
                  <TableCell>{purchase.user_name}<br/>{purchase.user_email}</TableCell>
                  <TableCell>{purchase.product_name}</TableCell>
                  <TableCell>{purchase.quantity}</TableCell>
                  <TableCell>₹{purchase.product_price.toFixed(2)}</TableCell>
                  <TableCell>{formatDate(purchase.purchase_date)}</TableCell>
                  <TableCell>{getStatusBadge(purchase.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => viewPurchaseDetails(purchase)}
                      >
                        Details
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => handleDeletePurchase(purchase.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      
      {/* Purchase Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Purchase Details</DialogTitle>
          </DialogHeader>
          
          {selectedPurchase && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium">Purchase Information</h3>
                  <p><span className="font-medium">Purchase ID:</span> {selectedPurchase.id}</p>
                  <p><span className="font-medium">Order ID:</span> {selectedPurchase.order_id}</p>
                  <p><span className="font-medium">Razorpay Order ID:</span> {selectedPurchase.razorpay_order_id}</p>
                  {selectedPurchase.razorpay_payment_id && (
                    <p><span className="font-medium">Razorpay Payment ID:</span> {selectedPurchase.razorpay_payment_id}</p>
                  )}
                  <p><span className="font-medium">Date:</span> {formatDate(selectedPurchase.purchase_date)}</p>
                  <p><span className="font-medium">Status:</span> {getStatusBadge(selectedPurchase.status)}</p>
                </div>
                
                <div>
                  <h3 className="font-medium">Customer Information</h3>
                  <p><span className="font-medium">Name:</span> {selectedPurchase.user_name}</p>
                  <p><span className="font-medium">Email:</span> {selectedPurchase.user_email}</p>
                  {selectedPurchase.user_phone && (
                    <p><span className="font-medium">Phone:</span> {selectedPurchase.user_phone}</p>
                  )}
                  {selectedPurchase.address && (
                    <p><span className="font-medium">Address:</span> {selectedPurchase.address}</p>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Product Details</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Product ID</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>{selectedPurchase.product_name}</TableCell>
                      <TableCell>{selectedPurchase.product_id}</TableCell>
                      <TableCell>
                        {selectedPurchase.color_name || 'N/A'}
                        {selectedPurchase.color_code && (
                          <div 
                            className="w-4 h-4 ml-2 inline-block border border-gray-300" 
                            style={{ backgroundColor: selectedPurchase.color_code }}
                          ></div>
                        )}
                      </TableCell>
                      <TableCell>{selectedPurchase.quantity}</TableCell>
                      <TableCell>₹{selectedPurchase.product_price.toFixed(2)}</TableCell>
                      <TableCell>₹{(selectedPurchase.product_price * selectedPurchase.quantity).toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              
              <div className="flex justify-between">
                <div>
                  <h3 className="font-medium mb-2">Update Status</h3>
                  <div className="flex gap-2">
                    <Button 
                      variant={selectedPurchase.status.toLowerCase() === 'pending' ? 'default' : 'outline'}
                      onClick={() => handleStatusChange(selectedPurchase.id, 'pending')}
                    >
                      Pending
                    </Button>
                    <Button 
                      variant={selectedPurchase.status.toLowerCase() === 'processing' ? 'default' : 'outline'}
                      onClick={() => handleStatusChange(selectedPurchase.id, 'processing')}
                    >
                      Processing
                    </Button>
                    <Button 
                      variant={selectedPurchase.status.toLowerCase() === 'completed' ? 'default' : 'outline'}
                      onClick={() => handleStatusChange(selectedPurchase.id, 'completed')}
                    >
                      Completed
                    </Button>
                    <Button 
                      variant={selectedPurchase.status.toLowerCase() === 'cancelled' ? 'default' : 'outline'}
                      className="bg-red-500 hover:bg-red-600"
                      onClick={() => handleStatusChange(selectedPurchase.id, 'cancelled')}
                    >
                      Cancelled
                    </Button>
                  </div>
                </div>
                <div>
                  <Button 
                    variant="destructive"
                    onClick={() => {
                      handleDeletePurchase(selectedPurchase.id);
                    }}
                  >
                    Delete Purchase
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 