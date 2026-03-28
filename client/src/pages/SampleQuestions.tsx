import { useState } from "react";
import NavBar from "@/components/NavBar";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, Search, BookOpen } from "lucide-react";

type CompetencyCode = "CCL" | "CP" | "STEM" | "CD" | "CPSAA" | "CC" | "CE" | "CCEC";
type YearGroup = "junior" | "primary" | "secondary";

const COMP_COLORS: Record<CompetencyCode, string> = {
  CCL: "bg-blue-100 text-blue-800 border-blue-200",
  CP: "bg-purple-100 text-purple-800 border-purple-200",
  STEM: "bg-green-100 text-green-800 border-green-200",
  CD: "bg-cyan-100 text-cyan-800 border-cyan-200",
  CPSAA: "bg-orange-100 text-orange-800 border-orange-200",
  CC: "bg-red-100 text-red-800 border-red-200",
  CE: "bg-yellow-100 text-yellow-800 border-yellow-200",
  CCEC: "bg-pink-100 text-pink-800 border-pink-200",
};

const YG_LABELS: Record<YearGroup, string> = {
  junior: "Junior (Yr 3–4)",
  primary: "Primary (Yr 5–6)",
  secondary: "Secondary (Yr 7–10)",
};

export default function SampleQuestions() {
  const [filterComp, setFilterComp] = useState<CompetencyCode | "">("");
  const [filterYG, setFilterYG] = useState<YearGroup | "">("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: competencies } = trpc.lomloe.getCompetencies.useQuery();
  const { data: questions, isLoading } = trpc.lomloe.getQuestions.useQuery({
    competency: filterComp || undefined,
    yearGroup: filterYG || undefined,
  });

  const filtered = (questions ?? []).filter((q) => {
    if (!search.trim()) return true;
    return (
      q.question.toLowerCase().includes(search.toLowerCase()) ||
      q.options.some((o) => o.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen samples-bg">
      <NavBar />
      <div className="container py-6 sm:py-10 max-w-4xl">
        {/* Header */}
        <div className="mb-8 space-y-2">
          <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-full px-4 py-1.5 text-sm font-semibold">
            <BookOpen className="w-4 h-4" /> Question Library
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-bold text-gray-900">Sample Questions by Category</h1>
          <p className="text-gray-600 max-w-2xl">Browse all {questions?.length ?? "…"} LOMLOE-aligned questions organised by competency and year group.</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px] space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Competency</label>
            <select
              value={filterComp}
              onChange={(e) => setFilterComp(e.target.value as CompetencyCode | "")}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
            >
              <option value="">All Competencies</option>
              {(competencies ?? []).map((c) => (
                <option key={c.code} value={c.code}>{c.code} – {c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px] space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Year Group</label>
            <select
              value={filterYG}
              onChange={(e) => setFilterYG(e.target.value as YearGroup | "")}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
            >
              <option value="">All Year Groups</option>
              <option value="junior">Junior (Yr 3–4)</option>
              <option value="primary">Primary (Yr 5–6)</option>
              <option value="secondary">Secondary (Yr 7–10)</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px] space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions…"
                className="pl-9"
              />
            </div>
          </div>
          {(filterComp || filterYG || search) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setFilterComp(""); setFilterYG(""); setSearch(""); }}
              className="text-gray-500 hover:text-gray-700"
            >
              Clear
            </Button>
          )}
        </div>

        {/* Count */}
        <p className="text-sm text-gray-500 mb-4">
          Showing <span className="font-semibold text-gray-700">{filtered.length}</span> question{filtered.length !== 1 ? "s" : ""}
        </p>

        {/* Question list */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse h-16" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>No questions match your filters.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((q) => {
              const isOpen = expanded.has(q.id);
              return (
                <div
                  key={q.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-shadow hover:shadow-md"
                >
                  <button
                    className="w-full text-left p-4 flex items-start gap-3"
                    onClick={() => toggle(q.id)}
                  >
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap gap-2">
                        <Badge className={`text-xs ${COMP_COLORS[q.competency as CompetencyCode] ?? "bg-gray-100 text-gray-700"}`}>
                          {q.competency}
                        </Badge>
                        <Badge variant="outline" className="text-xs text-gray-500">
                          {YG_LABELS[q.yearGroup as YearGroup] ?? q.yearGroup}
                        </Badge>
                      </div>
                      <p className="text-sm sm:text-base font-medium text-gray-800 leading-snug">{q.question}</p>
                    </div>
                    <div className="shrink-0 mt-1 text-gray-400">
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt, i) => (
                          <div
                            key={i}
                            className={`rounded-lg border p-2.5 text-sm flex items-start gap-2 ${
                              i === q.correctIndex
                                ? "bg-green-50 border-green-300 text-green-800 font-medium"
                                : "bg-white border-gray-200 text-gray-700"
                            }`}
                          >
                            <span className={`font-bold shrink-0 ${i === q.correctIndex ? "text-green-600" : "text-gray-400"}`}>
                              {String.fromCharCode(65 + i)}.
                            </span>
                            {opt}
                            {i === q.correctIndex && <span className="ml-auto text-green-500 shrink-0">✓</span>}
                          </div>
                        ))}
                      </div>
                      {q.explanation && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                          <span className="font-semibold">Explanation: </span>{q.explanation}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
