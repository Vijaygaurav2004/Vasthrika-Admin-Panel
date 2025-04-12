// lib/firebase/products.ts
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from "firebase/firestore";
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject
} from "firebase/storage";
import { db, storage } from "./config";

// Define types
export type Product = {
  id?: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  material?: string;
  color?: string;
  dimensions?: string;
  weight?: string;
  images: string[];
  createdAt?: any;
  updatedAt?: any;
};

// Get all products
export async function getProducts(categoryFilter?: string) {
  try {
    let productsQuery;
    
    if (categoryFilter) {
      productsQuery = query(
        collection(db, "products"),
        where("category", "==", categoryFilter),
        orderBy("createdAt", "desc")
      );
    } else {
      productsQuery = query(
        collection(db, "products"),
        orderBy("createdAt", "desc")
      );
    }
    
    const querySnapshot = await getDocs(productsQuery);
    
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Product[];
  } catch (error) {
    console.error("Error getting products:", error);
    throw error;
  }
}

// Get a single product
export async function getProduct(id: string) {
  try {
    const docRef = doc(db, "products", id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Product;
    } else {
      throw new Error("Product not found");
    }
  } catch (error) {
    console.error("Error getting product:", error);
    throw error;
  }
}

// Upload product images
export async function uploadProductImages(files: File[]) {
  try {
    const uploadPromises = files.map(async (file) => {
      const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      return new Promise<string>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          () => {},
          (error) => {
            reject(error);
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          }
        );
      });
    });
    
    return Promise.all(uploadPromises);
  } catch (error) {
    console.error("Error uploading images:", error);
    throw error;
  }
}

// Add a new product
export async function addProduct(product: Omit<Product, "id">) {
  try {
    const docRef = await addDoc(collection(db, "products"), {
      ...product,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    return { id: docRef.id, ...product };
  } catch (error) {
    console.error("Error adding product:", error);
    throw error;
  }
}

// Update a product
export async function updateProduct(id: string, updates: Partial<Product>) {
  try {
    const docRef = doc(db, "products", id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    
    return { id, ...updates };
  } catch (error) {
    console.error("Error updating product:", error);
    throw error;
  }
}

// lib/firebase/products.ts
// Update the deleteProduct function to accept an array of images
export async function deleteProduct(id: string, images: string[] = []) {
  try {
    // First, delete the product document
    await deleteDoc(doc(db, "products", id));
    
    // Then, delete associated images from storage
    const deletePromises = images.map(async (url) => {
      if (!url) return;
      
      try {
        // Extract the path from the URL
        const imagePath = url.split('products%2F')[1]?.split('?')[0];
        if (!imagePath) return;
        
        const storageRef = ref(storage, `products/${decodeURIComponent(imagePath)}`);
        await deleteObject(storageRef);
      } catch (error) {
        console.error("Error deleting image:", error);
        // Continue with other deletions even if one fails
      }
    });
    
    await Promise.all(deletePromises);
    
    return { success: true };
  } catch (error) {
    console.error("Error deleting product:", error);
    throw error;
  }
}