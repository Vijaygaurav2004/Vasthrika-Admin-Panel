"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

interface DragDropUploadProps {
  onFilesSelected: (files: File[] | ((prevFiles: File[]) => File[])) => void;
  existingImages: string[];
  onRemoveExistingImage: (url: string) => void;
  maxFiles?: number;
}

// Client component wrapper
function DragDropUploadClient({
  onFilesSelected,
  existingImages,
  onRemoveExistingImage,
  maxFiles = 5,
}: DragDropUploadProps) {
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const totalFiles = existingImages.length + acceptedFiles.length;
      
      if (totalFiles > maxFiles) {
        toast({
          title: "Error",
          description: `You can only upload up to ${maxFiles} images. Please remove some existing images first.`,
          variant: "destructive",
        });
        return;
      }

      // Validate file sizes
      const maxSize = 5 * 1024 * 1024; // 5MB
      const invalidFiles = acceptedFiles.filter(file => file.size > maxSize);
      if (invalidFiles.length > 0) {
        toast({
          title: "Error",
          description: "Some files are too large. Maximum file size is 5MB.",
          variant: "destructive",
        });
        return;
      }

      // Keep existing files and add new ones
      onFilesSelected((prevFiles: File[]) => [...prevFiles, ...acceptedFiles]);
      setPreviewUrls(prevUrls => [
        ...prevUrls,
        ...acceptedFiles.map(file => URL.createObjectURL(file))
      ]);
    },
    [existingImages.length, maxFiles, onFilesSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: maxFiles - existingImages.length,
    maxSize: 5 * 1024 * 1024, // 5MB
    multiple: true,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? "border-primary bg-primary/5" : "border-gray-300"
        }`}
      >
        <input {...getInputProps()} />
        <div className="space-y-2">
          <p className="text-lg font-medium">
            {isDragActive ? "Drop the files here" : "Drag & drop images here"}
          </p>
          <p className="text-sm text-gray-500">
            or click to select files (up to {maxFiles - existingImages.length} more)
          </p>
        </div>
      </div>

      {/* Preview existing images */}
      {existingImages.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Existing Images</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {existingImages.map((url, index) => (
              <div key={index} className="relative group aspect-square">
                <div className="relative w-full h-full">
                  <Image
                    src={url}
                    alt={`Product ${index}`}
                    fill
                    sizes="(min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
                    className="rounded-md object-cover"
                    priority={false}
                    unoptimized={url.startsWith('blob:')}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder.svg';
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onRemoveExistingImage(url)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview new images */}
      {previewUrls.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">New Images</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {previewUrls.map((url, index) => (
              <div key={index} className="relative group aspect-square">
                <div className="relative w-full h-full">
                  <Image
                    src={url}
                    alt={`New ${index}`}
                    fill
                    sizes="(min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
                    className="rounded-md object-cover"
                    priority={false}
                    unoptimized={url.startsWith('blob:')}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder.svg';
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => {
                    const newPreviewUrls = previewUrls.filter((_, i) => i !== index);
                    setPreviewUrls(newPreviewUrls);
                    // Update the selected files to match the remaining previews
                    onFilesSelected((prevFiles: File[]) => 
                      prevFiles.filter((_: File, i: number) => i !== index)
                    );
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Server component wrapper
export default function DragDropUpload(props: DragDropUploadProps) {
  return <DragDropUploadClient {...props} />;
} 