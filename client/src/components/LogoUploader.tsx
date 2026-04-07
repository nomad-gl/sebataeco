/**
 * LogoUploader
 *
 * A self-contained component that lets the user upload a school logo image.
 * The logo is stored as a base64 data-URL in localStorage under the key
 * "seba_school_logo" so it persists across sessions and is available to all
 * print/PDF flows without requiring a server upload.
 *
 * Usage:
 *   <LogoUploader />
 *
 * The component reads and writes localStorage directly; no props are required.
 * Consumers that need to react to changes can listen to the "seba_logo_changed"
 * custom window event.
 */

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, ImageIcon } from "lucide-react";

const STORAGE_KEY = "seba_school_logo";
const MAX_SIZE_BYTES = 500 * 1024; // 500 KB — keeps localStorage lean

export default function LogoUploader() {
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load existing logo on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setLogoDataUrl(stored);
  }, []);

  const handleFile = (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please upload a PNG, JPG, or SVG image.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("Image must be under 500 KB. Try a smaller or compressed file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      localStorage.setItem(STORAGE_KEY, dataUrl);
      setLogoDataUrl(dataUrl);
      window.dispatchEvent(new CustomEvent("seba_logo_changed", { detail: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleRemove = () => {
    localStorage.removeItem(STORAGE_KEY);
    setLogoDataUrl(null);
    window.dispatchEvent(new CustomEvent("seba_logo_changed", { detail: null }));
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">School Logo</Label>
      <p className="text-xs text-muted-foreground">
        Upload once — the logo will appear on all printed lesson plans and PDF worksheets.
        Accepted: PNG, JPG, SVG · Max 500 KB.
      </p>

      {logoDataUrl ? (
        /* Preview */
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <img
            src={logoDataUrl}
            alt="School logo preview"
            className="h-12 max-w-[120px] object-contain rounded"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">Logo saved</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="w-3 h-3" /> Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-red-500 hover:text-red-600 h-8 w-8"
              onClick={handleRemove}
              title="Remove logo"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        /* Drop zone */
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 p-5 cursor-pointer hover:border-primary/50 hover:bg-muted/40 transition-colors"
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        >
          <ImageIcon className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">
            Click or drag & drop your school logo here
          </p>
          <Button type="button" variant="outline" size="sm" className="gap-1.5 pointer-events-none">
            <Upload className="w-3.5 h-3.5" /> Browse
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
