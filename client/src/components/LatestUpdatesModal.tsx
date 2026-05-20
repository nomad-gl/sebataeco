import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";

export interface Update {
  id: number;
  title: string;
  description: string;
  version: string;
  createdAt: Date;
}

interface LatestUpdatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  updates: Update[];
}

export function LatestUpdatesModal({
  isOpen,
  onClose,
  updates,
}: LatestUpdatesModalProps) {
  const { t } = useI18n();
  const [currentIndex, setCurrentIndex] = useState(0);
  const markAsViewedMutation = trpc.updates.markAsViewed.useMutation();

  if (!updates || updates.length === 0) {
    return null;
  }

  const currentUpdate = updates[currentIndex];

  const handleNext = () => {
    if (currentIndex < updates.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleClose = () => {
    // Mark current update as viewed before closing
    if (currentUpdate) {
      markAsViewedMutation.mutate({ updateId: currentUpdate.id });
    }
    onClose();
  };

  const handleDismissAll = () => {
    // Mark all updates as viewed
    updates.forEach((update) => {
      markAsViewedMutation.mutate({ updateId: update.id });
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold">
                {t("latest_updates")}
              </DialogTitle>
              <DialogDescription>
                {t("new_features_and_improvements")}
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Update Content */}
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold">{currentUpdate.title}</h3>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline">{currentUpdate.version}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {new Date(currentUpdate.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {currentUpdate.description}
            </p>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {currentIndex + 1} {t("of")} {updates.length}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={currentIndex === updates.length - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleDismissAll}
            >
              {t("dismiss_all")}
            </Button>
            <Button className="flex-1" onClick={handleClose}>
              {currentIndex === updates.length - 1
                ? t("got_it")
                : t("next_update")}
            </Button>
          </div>
        </div>

        {/* Progress Dots */}
        <div className="flex justify-center gap-1 pb-2">
          {updates.map((_, index) => (
            <div
              key={index}
              className={`h-2 w-2 rounded-full transition-colors ${
                index === currentIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
