/**
 * AinaContext — keeps the AINA chat session alive in memory even when the user
 * navigates away from the Chat page. On returning to /chat, the page reads from
 * this context and continues from where the user left off.
 */
import { createContext, useContext, useState, useRef, type ReactNode } from "react";
import type { Message } from "@/components/AIChatBox";

interface AinaState {
  messages: Message[];
  activeSessionId: number | null;
  competency: string | undefined;
  yearGroup: string | undefined;
}

interface AinaContextValue {
  state: AinaState;
  setMessages: (msgs: Message[] | ((prev: Message[]) => Message[])) => void;
  setActiveSessionId: (id: number | null) => void;
  setCompetency: (c: string | undefined) => void;
  setYearGroup: (y: string | undefined) => void;
  resetSession: () => void;
}

const DEFAULT_STATE: AinaState = {
  messages: [],
  activeSessionId: null,
  competency: undefined,
  yearGroup: undefined,
};

const AinaContext = createContext<AinaContextValue | null>(null);

export function AinaProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AinaState>(DEFAULT_STATE);

  const setMessages = (msgs: Message[] | ((prev: Message[]) => Message[])) => {
    setState((prev) => ({
      ...prev,
      messages: typeof msgs === "function" ? msgs(prev.messages) : msgs,
    }));
  };

  const setActiveSessionId = (id: number | null) => {
    setState((prev) => ({ ...prev, activeSessionId: id }));
    // Persist last session ID to localStorage so it survives page refresh
    if (id !== null) localStorage.setItem("aina_last_session", String(id));
    else localStorage.removeItem("aina_last_session");
  };

  const setCompetency = (c: string | undefined) =>
    setState((prev) => ({ ...prev, competency: c }));

  const setYearGroup = (y: string | undefined) =>
    setState((prev) => ({ ...prev, yearGroup: y }));

  const resetSession = () => {
    setState(DEFAULT_STATE);
    localStorage.removeItem("aina_last_session");
  };

  return (
    <AinaContext.Provider
      value={{ state, setMessages, setActiveSessionId, setCompetency, setYearGroup, resetSession }}
    >
      {children}
    </AinaContext.Provider>
  );
}

export function useAina() {
  const ctx = useContext(AinaContext);
  if (!ctx) throw new Error("useAina must be used inside AinaProvider");
  return ctx;
}
