"use client";

import { useState, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import DragDropUpload from "@/components/drag-drop-upload";
import { ColorVariant } from "@/types/product";

interface ColorVariantUploadProps {
  colorVariants: ColorVariant[];
  onColorVariantsChange: (variants: ColorVariant[]) => void;
  // This is used by the parent to track files that need to be uploaded
  onVariantFilesChange?: (index: number, files: File[]) => void;
}

function getColorHex(colorName: string): string {
  // Map common color names to hex values - add more as needed
  const colorMap: Record<string, string> = {
    'black': '#000000',
    'white': '#FFFFFF',
    'red': '#FF0000',
    'green': '#008000',
    'blue': '#0000FF',
    'yellow': '#FFFF00',
    'purple': '#800080',
    'orange': '#FFA500',
    'pink': '#FFC0CB',
    'brown': '#A52A2A',
    'gray': '#808080',
    'grey': '#808080',
    'teal': '#008080',
    'navy': '#000080',
    'maroon': '#800000',
    'olive': '#808000',
    'silver': '#C0C0C0',
    'gold': '#FFD700',
  };
  
  // Check for exact match
  const lowerColor = colorName.toLowerCase();
  if (colorMap[lowerColor]) {
    return colorMap[lowerColor];
  }
  
  // Look for partial matches
  for (const [name, hex] of Object.entries(colorMap)) {
    if (lowerColor.includes(name)) {
      return hex;
    }
  }
  
  // Default fallback
  return "#e2e2e2";
}

export default function ColorVariantUpload({
  colorVariants,
  onColorVariantsChange,
  onVariantFilesChange,
}: ColorVariantUploadProps) {
  const [expandedVariant, setExpandedVariant] = useState<number | null>(null);
  // Track uploaded files for previews
  const [variantFilesPreviews, setVariantFilesPreviews] = useState<Record<number, string[]>>({});
  // Track actual files for upload
  const variantFiles = useRef<Record<number, File[]>>({});

  const addColorVariant = () => {
    const newVariant: ColorVariant = {
      color: "",
      images: [],
      stock: 0,
    };
    onColorVariantsChange([...colorVariants, newVariant]);
    // Expand the newly added variant
    setExpandedVariant(colorVariants.length);
  };

  const updateColorVariant = (index: number, field: keyof ColorVariant, value: any) => {
    const updatedVariants = [...colorVariants];
    updatedVariants[index] = {
      ...updatedVariants[index],
      [field]: value,
    };
    onColorVariantsChange(updatedVariants);
  };

  const removeColorVariant = (index: number) => {
    const updatedVariants = colorVariants.filter((_, i) => i !== index);
    onColorVariantsChange(updatedVariants);
    
    // Clean up file previews and actual files
    const updatedPreviews = { ...variantFilesPreviews };
    delete updatedPreviews[index];
    setVariantFilesPreviews(updatedPreviews);
    
    const updatedFiles = { ...variantFiles.current };
    delete updatedFiles[index];
    variantFiles.current = updatedFiles;
    
    setExpandedVariant(null);
  };

  const handleImageChange = (
    index: number,
    files: File[] | ((prevFiles: File[]) => File[])
  ) => {
    // Handle file preview URLs
    if (typeof files === 'function') {
      const currentFiles = variantFiles.current[index] || [];
      const updatedFiles = files(currentFiles);
      
      // Generate new preview URLs
      const updatedPreviews = updatedFiles.map(file => URL.createObjectURL(file));
      
      // Update previews
      setVariantFilesPreviews(prev => ({
        ...prev,
        [index]: updatedPreviews
      }));
      
      // Update actual files
      variantFiles.current = {
        ...variantFiles.current,
        [index]: updatedFiles
      };
      
      // Notify parent component
      if (onVariantFilesChange) {
        onVariantFilesChange(index, updatedFiles);
      }
    } else {
      // Generate preview URLs for new files
      const newPreviews = files.map(file => URL.createObjectURL(file));
      
      // Update previews
      setVariantFilesPreviews(prev => ({
        ...prev,
        [index]: [...(prev[index] || []), ...newPreviews]
      }));
      
      // Update actual files
      variantFiles.current = {
        ...variantFiles.current,
        [index]: [...(variantFiles.current[index] || []), ...files]
      };
      
      // Notify parent component
      if (onVariantFilesChange) {
        onVariantFilesChange(index, [
          ...(variantFiles.current[index] || []),
          ...files
        ]);
      }
    }
  };

  const handleExistingImageChange = (index: number, updatedImages: string[]) => {
    const updatedVariants = [...colorVariants];
    updatedVariants[index] = {
      ...updatedVariants[index],
      images: updatedImages,
    };
    onColorVariantsChange(updatedVariants);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label>Color Variants</Label>
        <Button
          type="button"
          onClick={addColorVariant}
          variant="outline"
          size="sm"
          className="flex items-center gap-1"
        >
          <Plus size={16} /> Add Color
        </Button>
      </div>

      {colorVariants.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500">No color variants added yet.</p>
          <p className="text-sm text-gray-400 mt-1">
            Add color variants to show product in different colors.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {colorVariants.map((variant, index) => (
            <div
              key={index}
              className="border rounded-lg overflow-hidden"
            >
              <div
                className="p-4 bg-gray-50 flex justify-between items-center cursor-pointer"
                onClick={() => setExpandedVariant(expandedVariant === index ? null : index)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-full border"
                    style={{ backgroundColor: getColorHex(variant.color) }}
                  ></div>
                  <span className="font-medium">
                    {variant.color ? variant.color : "Unnamed color"}
                  </span>
                  <span className="text-gray-500 text-sm">
                    ({variant.images.length + (variantFilesPreviews[index]?.length || 0)} images, {variant.stock} in stock)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeColorVariant(index);
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>

              {expandedVariant === index && (
                <div className="p-4 border-t">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`color-${index}`}>Color Name</Label>
                      <Input
                        id={`color-${index}`}
                        value={variant.color}
                        onChange={(e) =>
                          updateColorVariant(index, "color", e.target.value)
                        }
                        placeholder="e.g., Royal Blue, Crimson Red"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`stock-${index}`}>Stock</Label>
                      <Input
                        id={`stock-${index}`}
                        type="number"
                        min="0"
                        value={variant.stock}
                        onChange={(e) =>
                          updateColorVariant(
                            index,
                            "stock",
                            parseInt(e.target.value) || 0
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <Label>Color Images</Label>
                    <div className="mt-2">
                      <DragDropUpload
                        onFilesSelected={(files) => handleImageChange(index, files)}
                        existingImages={[...variant.images, ...(variantFilesPreviews[index] || [])]}
                        onRemoveExistingImage={(url) => {
                          // If it's a file preview URL
                          if (variantFilesPreviews[index]?.includes(url)) {
                            const previewIndex = variantFilesPreviews[index].indexOf(url);
                            
                            // Update preview URLs
                            const updatedPreviews = { ...variantFilesPreviews };
                            updatedPreviews[index] = updatedPreviews[index].filter((_, i) => i !== previewIndex);
                            setVariantFilesPreviews(updatedPreviews);
                            
                            // Update actual files
                            if (variantFiles.current[index]) {
                              variantFiles.current[index] = variantFiles.current[index].filter((_, i) => i !== previewIndex);
                              
                              // Notify parent
                              if (onVariantFilesChange) {
                                onVariantFilesChange(index, variantFiles.current[index]);
                              }
                            }
                          } else {
                            // It's an existing image URL
                            const updatedImages = variant.images.filter(
                              (img) => img !== url
                            );
                            handleExistingImageChange(index, updatedImages);
                          }
                        }}
                        maxFiles={5}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Upload images showing the product in this specific color
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-sm text-gray-500 mt-2">
        Add color variants to allow customers to choose from different colors, each with its own images.
      </p>
    </div>
  );
} 