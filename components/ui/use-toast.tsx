import * as React from "react"
import { cn } from "@/lib/utils"

export type ToastProps = {
  title?: string
  description?: string
  variant?: "default" | "destructive"
}

export function toast({ title, description, variant = "default" }: ToastProps) {
  // For now, we'll use a simple alert. In a real app, you'd want to use a proper toast library
  if (variant === "destructive") {
    console.error(title, description)
  } else {
    console.log(title, description)
  }
} 