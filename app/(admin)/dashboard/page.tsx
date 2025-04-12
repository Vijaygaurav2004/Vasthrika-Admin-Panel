// app/(admin)/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, getDocs, query, where, getCountFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStockProducts: 0,
    categories: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Get total products count
        const productsCollection = collection(db, "products");
        const productsSnapshot = await getCountFromServer(productsCollection);
        const totalProducts = productsSnapshot.data().count;

        // Get low stock products count (less than 5 items)
        const lowStockQuery = query(
          productsCollection,
          where("stock", "<", 5)
        );
        const lowStockSnapshot = await getCountFromServer(lowStockQuery);
        const lowStockProducts = lowStockSnapshot.data().count;

        // Get unique categories
        const productsData = await getDocs(productsCollection);
        const categories = new Set();
        productsData.forEach((doc) => {
          const data = doc.data();
          if (data.category) {
            categories.add(data.category);
          }
        });

        setStats({
          totalProducts,
          lowStockProducts,
          categories: categories.size,
        });
        setLoading(false);
      } catch (error) {
        console.error("Error fetching stats:", error);
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="mb-2 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          <p>Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <p className="text-xs text-muted-foreground">
              Products in inventory
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Alert</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.lowStockProducts}</div>
            <p className="text-xs text-muted-foreground">
              Products with fewer than 5 items in stock
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.categories}</div>
            <p className="text-xs text-muted-foreground">
              Product categories
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full">
              <Link href="/products/new">Add New Product</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/products">View All Products</Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Low Stock Products</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.lowStockProducts > 0 ? (
              <p>
                You have {stats.lowStockProducts} products with low stock levels.
                Consider restocking soon.
              </p>
            ) : (
              <p>All products are well-stocked.</p>
            )}
            <Button asChild variant="outline" className="mt-4">
              <Link href="/products">Manage Inventory</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}