"use client";

import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";

interface QrScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

const READER_ID = "qr-reader-region";

/**
 * Full-screen camera QR scanner modal.
 * Calls onScan(code) once a QR is decoded, then the parent decides what to do.
 */
export function QrScanner({ onScan, onClose }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startedRef = useRef(false);
  // Keep the latest onScan without restarting the camera.
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    const scanner = new Html5Qrcode(READER_ID, { verbose: false });
    scannerRef.current = scanner;
    let handled = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          if (handled) return;
          handled = true;
          onScanRef.current(decodedText);
        },
        () => {
          /* ignore per-frame decode misses */
        }
      )
      .then(() => {
        startedRef.current = true;
      })
      .catch((err) => {
        console.error("Camera start failed:", err);
      });

    return () => {
      if (startedRef.current && scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              scannerRef.current?.clear();
            } catch {
              /* noop */
            }
          });
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">Scan saree QR</h3>
          <button
            onClick={onClose}
            aria-label="Close scanner"
            className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div id={READER_ID} className="overflow-hidden rounded-lg bg-black" />
        <p className="mt-3 text-center text-xs text-gray-500">
          Point the camera at the QR sticker on the saree.
        </p>
        <Button variant="outline" className="mt-3 w-full" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
