import { X, Sparkles, Zap, Bot, Download, Bell } from "lucide-react";

interface WhatsNewModalProps {
  open: boolean;
  onClose: () => void;
}

const CHANGELOG = [
  {
    icon: Bot,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    title: "Aina self-learning",
    desc: "Aina now remembers your questioning style, preferred competencies, and teaching context — adapting her tone and depth with every conversation.",
  },
  {
    icon: Sparkles,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
    title: "Follow-on question chips",
    desc: "After each Aina response, 2–3 contextual follow-on questions appear as chips so you can keep the conversation going with one tap.",
  },
  {
    icon: Download,
    color: "text-green-400",
    bg: "bg-green-400/10",
    title: "Install as an app",
    desc: "AINA is now a Progressive Web App. Use the Download App button on the homepage or NavBar to install it directly to your home screen.",
  },
  {
    icon: Bell,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    title: "Update notifications",
    desc: "A banner now appears at the top of the page whenever a new version of AINA is available, so you're always on the latest release.",
  },
  {
    icon: Zap,
    color: "text-rose-400",
    bg: "bg-rose-400/10",
    title: "Faster Aina responses",
    desc: "Wake-word detection is more responsive and language consistency is improved — Aina now always replies in your selected UI language.",
  },
];

export default function WhatsNewModal({ open, onClose }: WhatsNewModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#0f172a] border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-white">What's New in AINA</h2>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Changelog list */}
        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {CHANGELOG.map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} className="flex gap-3">
              <div className={`flex-shrink-0 w-9 h-9 rounded-xl ${bg} flex items-center justify-center mt-0.5`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-tight">{title}</p>
                <p className="text-xs text-white/55 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
