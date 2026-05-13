/**
 * TemplatePreviewModal.tsx
 *
 * Modal for previewing template structure before applying
 */

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, X } from "lucide-react";

export interface TemplateData {
  id: number;
  name: string;
  description?: string;
  type: string;
  structure: Record<string, unknown>;
  createdAt?: string;
}

interface TemplatePreviewModalProps {
  template: TemplateData | null;
  isOpen: boolean;
  onClose: () => void;
  onUse: () => void;
  isLoading?: boolean;
}

export function TemplatePreviewModal({
  template,
  isOpen,
  onClose,
  onUse,
  isLoading = false,
}: TemplatePreviewModalProps) {
  if (!template) return null;

  const getTemplateStats = (structure: Record<string, unknown>) => {
    const stats: { label: string; value: number | string }[] = [];

    if (Array.isArray(structure.questions)) {
      stats.push({ label: "Questions", value: structure.questions.length });
    }
    if (Array.isArray(structure.slides)) {
      stats.push({ label: "Slides", value: structure.slides.length });
    }
    if (Array.isArray(structure.words)) {
      stats.push({ label: "Words", value: structure.words.length });
    }
    if (Array.isArray(structure.cards)) {
      stats.push({ label: "Cards", value: structure.cards.length });
    }
    if (structure.passage) {
      stats.push({ label: "Passage", value: "Yes" });
    }

    return stats;
  };

  const stats = getTemplateStats(template.structure);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Template Preview
          </DialogTitle>
          <DialogDescription>
            Review template details before applying to your material
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Template Header */}
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{template.name}</h3>
                  {template.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {template.description}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className="capitalize">
                  {template.type}
                </Badge>
              </div>
            </div>

            {/* Template Stats */}
            {stats.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg border border-border p-3 bg-muted/30"
                  >
                    <p className="text-xs text-muted-foreground font-medium">
                      {stat.label}
                    </p>
                    <p className="text-lg font-semibold mt-1">{stat.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Template Structure Preview */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Template Structure</h4>

              {/* Questions Preview */}
              {Array.isArray(template.structure.questions) &&
                template.structure.questions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Questions ({template.structure.questions.length})
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {(template.structure.questions as any[])
                        .slice(0, 3)
                        .map((q, i) => (
                          <div
                            key={i}
                            className="text-xs p-2 bg-muted/50 rounded border border-border/50"
                          >
                            <p className="font-medium truncate">
                              {i + 1}. {q.question || "Untitled"}
                            </p>
                            {q.options && (
                              <p className="text-muted-foreground text-xs mt-1">
                                {q.options.length} options
                              </p>
                            )}
                          </div>
                        ))}
                      {(template.structure.questions as any[]).length > 3 && (
                        <p className="text-xs text-muted-foreground italic">
                          +{(template.structure.questions as any[]).length - 3}{" "}
                          more
                        </p>
                      )}
                    </div>
                  </div>
                )}

              {/* Slides Preview */}
              {Array.isArray(template.structure.slides) &&
                template.structure.slides.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Slides ({template.structure.slides.length})
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {(template.structure.slides as any[])
                        .slice(0, 3)
                        .map((s, i) => (
                          <div
                            key={i}
                            className="text-xs p-2 bg-muted/50 rounded border border-border/50"
                          >
                            <p className="font-medium truncate">
                              Slide {i + 1}: {s.heading || "Untitled"}
                            </p>
                          </div>
                        ))}
                      {(template.structure.slides as any[]).length > 3 && (
                        <p className="text-xs text-muted-foreground italic">
                          +{(template.structure.slides as any[]).length - 3}{" "}
                          more
                        </p>
                      )}
                    </div>
                  </div>
                )}

              {/* Words Preview */}
              {Array.isArray(template.structure.words) &&
                template.structure.words.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Words ({template.structure.words.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(template.structure.words as any[])
                        .slice(0, 5)
                        .map((w, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {w.word || w}
                          </Badge>
                        ))}
                      {(template.structure.words as any[]).length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{(template.structure.words as any[]).length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
            </div>

            {/* Info Message */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs text-blue-900">
                ℹ️ Using this template will pre-fill your material form with the
                structure shown above. You can edit any content after applying.
              </p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={onUse} disabled={isLoading}>
            {isLoading ? "Loading..." : "Use This Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
