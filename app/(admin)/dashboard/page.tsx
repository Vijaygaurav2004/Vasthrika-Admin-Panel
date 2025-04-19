// app/(admin)/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalCategories: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        if (!supabase) {
          setStats({
            totalProducts: 0,
            totalCategories: 0,
          });
          return;
        }
        
        // Get total products count
        const { count: productsCount } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true });

        // Get total categories count
        const { count: categoriesCount } = await supabase
          .from('categories')
          .select('*', { count: 'exact', head: true });

        setStats({
          totalProducts: productsCount || 0,
          totalCategories: categoriesCount || 0,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    }

    fetchStats();
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalProducts}</p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/products">View Products</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalCategories}</p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/categories">View Categories</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}