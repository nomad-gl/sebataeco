import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useI18n } from "@/contexts/I18nContext";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type PwaInstallState =
  | "unavailable"   // Already installed, or browser doesn't support
  | "android"       // Chrome/Edge — native prompt available
  | "ios";          // iOS Safari — manual steps required

/** Simple analytics logger — writes to localStorage and console */
function trackInstallEvent(event: string, meta?: Record<string, unknown>) {
  const entry = { event, ts: Date.now(), ...meta };
  try {
    const existing = JSON.parse(localStorage.getItem("seba_install_analytics") ?? "[]");
    existing.push(entry);
    // Keep only the last 50 entries
    localStorage.setItem("seba_install_analytics", JSON.stringify(existing.slice(-50)));
  } catch {
    // localStorage unavailable — ignore
  }
  console.info("[AINA install analytics]", entry);
}

export function usePwaInstall() {
  const [state, setState] = useState<PwaInstallState>("unavailable");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosModal, setShowIosModal] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    // Already running as installed PWA
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    // iOS Safari detection
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isIos && isSafari) {
      setState("ios");
      return;
    }

    // Android/Chrome — listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setState("android");
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Track successful installation
    const installedHandler = () => {
      trackInstallEvent("app_installed");
      toast.success(t("pwa_installed_title"), {
        description: t("pwa_installed_desc"),
        duration: 5000,
      });
      setState("unavailable");
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, [t]);

  const install = async () => {
    trackInstallEvent("install_button_clicked", { platform: state });

    if (state === "ios") {
      setShowIosModal(true);
      return;
    }
    if (state === "android" && deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      trackInstallEvent("install_prompt_response", { outcome: choice.outcome });
      if (choice.outcome === "accepted") {
        setState("unavailable");
        setDeferredPrompt(null);
      }
    }
  };

  return { state, install, showIosModal, setShowIosModal };
}
