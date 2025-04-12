// app/(admin)/categories/page.tsx
"use client";

import { useState, useEffect } from "react";
import { 
  collection, 
  getDocs, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp, 
  orderBy, 
  query 
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";

type Category = {
  id: string;
  name: string;
  createdAt?: any;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategory, setNewCategory] = useState("");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  useEffect(() => {
    console.log("Categories component mounted - fetching categories");
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    console.log("Fetching categories...");
    try {
      setLoading(true);
      const categoriesQuery = query(
        collection(db, "categories"),
        orderBy("createdAt", "desc")
      );
      console.log("Executing Firestore query...");
      const querySnapshot = await getDocs(categoriesQuery);
      console.log(`Got ${querySnapshot.docs.length} categories from Firestore`);
      
      const categoriesList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Category[];
      
      console.log("Categories list:", categoriesList);
      setCategories(categoriesList);
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast({
        title: "Error",
        description: "Failed to load categories: " + (error instanceof Error ? error.message : String(error)),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async () => {
    console.log("Adding new category:", newCategory);
    if (!newCategory.trim()) {
      toast({
        title: "Error",
        description: "Category name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("Creating new category document in Firestore...");
      // Create a new document in the "categories" collection
      const docRef = await addDoc(collection(db, "categories"), {
        name: newCategory,
        createdAt: serverTimestamp(),
      });
      console.log("Category added successfully with ID:", docRef.id);

      toast({
        title: "Success",
        description: "Category added successfully",
      });

      setNewCategory("");
      fetchCategories(); // Refresh the categories list
    } catch (error) {
      console.error("Error adding category:", error);
      toast({
        title: "Error",
        description: "Failed to add category: " + (error instanceof Error ? error.message : String(error)),
        variant: "destructive",
      });
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !editingCategory.name.trim()) {
      toast({
        title: "Error",
        description: "Category name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("Updating category:", editingCategory);
      const categoryRef = doc(db, "categories", editingCategory.id);
      await updateDoc(categoryRef, {
        name: editingCategory.name,
      });
      console.log("Category updated successfully");

      toast({
        title: "Success",
        description: "Category updated successfully",
      });

      setEditingCategory(null);
      fetchCategories();
    } catch (error) {
      console.error("Error updating category:", error);
      toast({
        title: "Error",
        description: "Failed to update category: " + (error instanceof Error ? error.message : String(error)),
        variant: "destructive",
      });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (confirm("Are you sure you want to delete this category?")) {
      try {
        console.log("Deleting category:", id);
        await deleteDoc(doc(db, "categories", id));
        console.log("Category deleted successfully");
        
        toast({
          title: "Success",
          description: "Category deleted successfully",
        });
        
        fetchCategories();
      } catch (error) {
        console.error("Error deleting category:", error);
        toast({
          title: "Error",
          description: "Failed to delete category: " + (error instanceof Error ? error.message : String(error)),
          variant: "destructive",
        });
      }
    }
  };

  // For form submission via keyboard (pressing Enter)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editingCategory) {
        handleUpdateCategory();
      } else {
        handleAddCategory();
      }
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Categories</h1>

      <div className="mb-8 rounded-lg border p-4">
        <h2 className="mb-4 text-lg font-medium">
          {editingCategory ? "Edit Category" : "Add New Category"}
        </h2>
        <div className="flex gap-2">
          <Input
            value={editingCategory ? editingCategory.name : newCategory}
            onChange={(e) =>
              editingCategory
                ? setEditingCategory({ ...editingCategory, name: e.target.value })
                : setNewCategory(e.target.value)
            }
            onKeyDown={handleKeyDown}
            placeholder="Enter category name"
          />
          {editingCategory ? (
            <div className="flex gap-2">
              <Button onClick={handleUpdateCategory}>Update</Button>
              <Button
                variant="outline"
                onClick={() => setEditingCategory(null)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button onClick={handleAddCategory}>Add Category</Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mb-2 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            <p>Loading categories...</p>
          </div>
        </div>
      ) : (
        <>
          {categories.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-muted-foreground">No categories found</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Add a new category using the form above.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category Name</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>{category.name}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingCategory(category)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteCategory(category.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}