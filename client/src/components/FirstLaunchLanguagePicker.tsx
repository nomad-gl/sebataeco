import { useState, useEffect } from "react";
import { useI18n, Lang } from "@/contexts/I18nContext";
import { SebaSymbol } from "@/components/SebaSymbol";

const STORAGE_KEY = "seba_lang_chosen";

const LANGUAGES: { code: Lang; label: string; nativeLabel: string; flag: string; desc: string }[] = [
  {
    code: "ca",
    label: "Catalan",
    nativeLabel: "Català",
    flag: "🏴󠁥󠁳󠁣󠁴󠁿",
    desc: "Continua en Català",
  },
  {
    code: "es",
    label: "Spanish",
    nativeLabel: "Español",
    flag: "🇪🇸",
    desc: "Continuar en Español",
  },
  {
    code: "en",
    label: "English",
    nativeLabel: "English",
    flag: "🇬🇧",
    desc: "Continue in English",
  },
];


export default function FirstLaunchLanguagePicker() {
  const { setLang } = useI18n();
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<Lang | null>(null);

  useEffect(() => {
    // Only show in standalone PWA mode on first launch
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const alreadyChosen = localStorage.getItem(STORAGE_KEY);
    if (isStandalone && !alreadyChosen) {
      setVisible(true);
    }
  }, []);

  const handleSelect = (code: Lang) => {
    setSelected(code);
    setTimeout(() => {
      setLang(code);
      localStorage.setItem(STORAGE_KEY, code);
      setVisible(false);
    }, 350);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-[#0b1120] px-6">
      {/* Background subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.7 0.15 240) 1px, transparent 1px), linear-gradient(90deg, oklch(0.7 0.15 240) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 flex flex-col items-center w-full max-w-sm">
        {/* Logo */}
        <SebaSymbol size={48} color="white" className="mb-6 drop-shadow-lg" />

        <h1 className="text-2xl font-bold text-white mb-1 text-center">
          Welcome to AINA
        </h1>
        <p className="text-sm text-white/55 mb-8 text-center">
          Choose your preferred language to get started
        </p>

        {/* Language cards */}
        <div className="flex flex-col gap-3 w-full">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`
                flex items-center gap-4 w-full px-5 py-4 rounded-2xl border transition-all duration-200
                ${
                  selected === lang.code
                    ? "bg-primary border-primary scale-[0.98] shadow-lg shadow-primary/30"
                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/25 active:scale-[0.97]"
                }
              `}
            >
              <span className="text-3xl leading-none select-none">{lang.flag}</span>
              <div className="flex flex-col items-start">
                <span className="text-base font-semibold text-white leading-tight">
                  {lang.nativeLabel}
                </span>
                <span className="text-xs text-white/50 mt-0.5">{lang.desc}</span>
              </div>
              {selected === lang.code && (
                <span className="ml-auto text-white/80 text-lg">✓</span>
              )}
            </button>
          ))}
        </div>

        <p className="mt-6 text-xs text-white/30 text-center">
          You can change this at any time from the navigation bar
        </p>
      </div>
    </div>
  );
}
