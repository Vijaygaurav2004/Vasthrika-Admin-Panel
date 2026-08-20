"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import StockOutMatcher from "@/components/admin/stock-out-matcher";

interface MatchResult {
  item_id: string;
  label: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  thumbnail: string;
}

interface MatchResponse {
  total_sarees_detected: number;
  matches: MatchResult[];
  unmatched_count: number;
}

export default function StockOutPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MatchResponse | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setPreviewUrl(URL.createObjectURL(acceptedFiles[0]));
      setResults(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpeg", ".jpg", ".png", ".webp"] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    multiple: false,
  });

  const handleFindMatches = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/stock-out", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResults(data);
      toast({
        title: data.matches.length > 0 ? "Matches found" : "No matches",
        description: data.matches.length > 0
          ? `Found ${data.matches.length} match(es) out of ${data.total_sarees_detected} detected.`
          : data.message || "No matches found in inventory.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to analyze photo.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => { setFile(null); setPreviewUrl(null); setResults(null); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stock Out</h1>
        <p className="mt-1 text-gray-500">Upload a group photo of sarees being sold. AI will match them against your inventory.</p>
      </div>

      {!results ? (
        <div className="space-y-6">
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Upload Group Photo</h2>
            <div
              {...getRootProps()}
              className={`cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors ${isDragActive ? "border-primary bg-primary/5" : "border-gray-300 hover:border-gray-400"}`}
            >
              <input {...getInputProps()} />
              <div className="space-y-3">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                  <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </div>
                <p className="text-lg font-medium">{isDragActive ? "Drop the group photo here" : "Drag & drop a group photo here"}</p>
                <p className="text-sm text-gray-500">or click to select (JPEG, PNG, WebP, up to 10MB)</p>
              </div>
            </div>

            {previewUrl && (
              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Selected Photo</h3>
                  <Button variant="outline" size="sm" onClick={handleReset}>Remove</Button>
                </div>
                <div className="mt-2 overflow-hidden rounded-lg border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Group photo preview" className="max-h-[400px] w-full object-contain" />
                </div>
              </div>
            )}
          </div>

          {file && (
            <div className="flex justify-end">
              <Button onClick={handleFindMatches} disabled={loading} size="lg" className="px-8">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Analyzing with AI...
                  </span>
                ) : "Find Matches"}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Match Results</h2>
            <Button variant="outline" onClick={handleReset}>Start Over</Button>
          </div>
          <StockOutMatcher results={results} groupPhotoUrl={previewUrl || ""} onComplete={() => { toast({ title: "Stock updated" }); handleReset(); }} />
        </div>
      )}
    </div>
  );
}
