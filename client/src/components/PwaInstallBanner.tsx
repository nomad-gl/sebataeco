import { useState, useEffect } from "react";
import { X, Download, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroid, setShowAndroid] = useState(false);
  const [showIos, setShowIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed or already installed
    const alreadyDismissed = localStorage.getItem("seba_pwa_dismissed");
    if (alreadyDismissed) return;

    // Check if already running as PWA (standalone)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // Detect iOS Safari
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isIos && isSafari) {
      // Show iOS instructions after a short delay
      const timer = setTimeout(() => setShowIos(true), 3000);
      return () => clearTimeout(timer);
    }

    // Listen for Android/Chrome install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowAndroid(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleDismiss = () => {
    setShowAndroid(false);
    setShowIos(false);
    setDismissed(true);
    localStorage.setItem("seba_pwa_dismissed", "1");
  };

  const handleInstallAndroid = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setShowAndroid(false);
      setDeferredPrompt(null);
    }
  };

  if (dismissed || (!showAndroid && !showIos)) return null;

  // Android / Chrome banner
  if (showAndroid) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto">
        <div className="bg-[#0f172a] border border-white/20 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Download className="size-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Install SEBA on your device</p>
            <p className="text-xs text-white/60 mt-0.5">
              Add to your home screen for instant access — works like a native app.
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleInstallAndroid}
                className="bg-white text-[#0f172a] hover:bg-white/90 font-semibold text-xs h-8"
              >
                Install
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="text-white/60 hover:text-white hover:bg-white/10 text-xs h-8"
              >
                Not now
              </Button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-white/40 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  // iOS Safari instructions
  if (showIos) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto">
        <div className="bg-[#0f172a] border border-white/20 rounded-2xl shadow-2xl p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <p className="text-sm font-semibold text-white">Install SEBA on your iPhone</p>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 text-white/40 hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
          <ol className="space-y-2">
            <li className="flex items-center gap-2 text-xs text-white/70">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-white text-[10px] font-bold">1</span>
              <span>Tap the <Share className="size-3.5 inline-block mx-0.5 text-blue-400" /> Share button in Safari</span>
            </li>
            <li className="flex items-center gap-2 text-xs text-white/70">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-white text-[10px] font-bold">2</span>
              <span>Scroll down and tap <strong className="text-white">"Add to Home Screen"</strong> <Plus className="size-3 inline-block ml-0.5" /></span>
            </li>
            <li className="flex items-center gap-2 text-xs text-white/70">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-white text-[10px] font-bold">3</span>
              <span>Tap <strong className="text-white">"Add"</strong> — SEBA will appear on your home screen</span>
            </li>
          </ol>
          <div className="mt-3 pt-3 border-t border-white/10">
            <button
              onClick={handleDismiss}
              className="text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
