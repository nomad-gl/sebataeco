import { useState, useEffect } from "react";

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Listen for messages from the service worker
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "UPDATE_AVAILABLE") {
        setUpdateAvailable(true);
      }
    };
    navigator.serviceWorker.addEventListener("message", handleMessage);

    // Also detect when a new SW is waiting (handles the case where the page
    // was already open when the SW installed)
    navigator.serviceWorker.ready.then((reg) => {
      setRegistration(reg);

      const checkWaiting = (reg: ServiceWorkerRegistration) => {
        if (reg.waiting) {
          setUpdateAvailable(true);
        }
      };

      checkWaiting(reg);

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
          }
        });
      });
    });

    // Poll for updates every 60 seconds while the page is open
    const interval = setInterval(() => {
      navigator.serviceWorker.ready.then((reg) => reg.update());
    }, 60_000);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
      clearInterval(interval);
    };
  }, []);

  const applyUpdate = () => {
    if (registration && registration.waiting) {
      // Tell the waiting SW to skip waiting and activate
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    // Reload to get the new version
    window.location.reload();
  };

  const dismiss = () => {
    setUpdateAvailable(false);
  };

  return { updateAvailable, applyUpdate, dismiss };
}
