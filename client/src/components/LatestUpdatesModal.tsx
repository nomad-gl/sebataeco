import React, { useState, useEffect } from "react";
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
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const markAsViewedMutation = trpc.updates.markAsViewed.useMutation();

  if (!updates || updates.length === 0) {
    return null;
  }

  const currentUpdate = updates[currentIndex];

  const handleNext = () => {
    if (currentIndex < updates.length - 1) {
      setIsAnimating(true);
      setDirection("next");
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
        setIsAnimating(false);
      }, 300);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setIsAnimating(true);
      setDirection("prev");
      setTimeout(() => {
        setCurrentIndex(currentIndex - 1);
        setIsAnimating(false);
      }, 300);
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
      <DialogContent className="max-w-2xl overflow-hidden">
        {/* Add animation styles */}
        <style>{`
          @keyframes slideInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes slideInDown {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes fadeInScale {
            from {
              opacity: 0;
              transform: scale(0.95);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }

          @keyframes slideOutLeft {
            from {
              opacity: 1;
              transform: translateX(0);
            }
            to {
              opacity: 0;
              transform: translateX(-20px);
            }
          }

          @keyframes slideOutRight {
            from {
              opacity: 1;
              transform: translateX(0);
            }
            to {
              opacity: 0;
              transform: translateX(20px);
            }
          }

          @keyframes slideInFromLeft {
            from {
              opacity: 0;
              transform: translateX(-20px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          @keyframes slideInFromRight {
            from {
              opacity: 0;
              transform: translateX(20px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          @keyframes dotPulse {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.3);
            }
          }

          .modal-header {
            animation: slideInDown 0.5s ease-out;
          }

          .modal-content {
            animation: ${
              isAnimating
                ? direction === "next"
                  ? "slideOutLeft"
                  : "slideOutRight"
                : direction === "next"
                  ? "slideInFromRight"
                  : "slideInFromLeft"
            } 0.3s ease-out;
          }

          .modal-footer {
            animation: slideInUp 0.5s ease-out 0.1s both;
          }

          .progress-dot {
            animation: ${
              currentIndex === updates.indexOf(updates[currentIndex])
                ? "dotPulse"
                : "none"
            } 0.6s ease-in-out;
          }

          .update-card {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .update-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
          }

          .nav-button {
            transition: all 0.2s ease-out;
          }

          .nav-button:not(:disabled):hover {
            transform: scale(1.05);
          }

          .nav-button:not(:disabled):active {
            transform: scale(0.95);
          }

          .action-button {
            transition: all 0.2s ease-out;
          }

          .action-button:hover {
            transform: translateY(-2px);
          }

          .action-button:active {
            transform: translateY(0);
          }
        `}</style>

        <DialogHeader className="modal-header">
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
              className="h-8 w-8 p-0 transition-transform hover:rotate-90"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Update Content */}
          <div
            className="modal-content update-card rounded-lg border border-border bg-card p-6"
            key={`update-${currentIndex}`}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold">{currentUpdate.title}</h3>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline" className="transition-all hover:bg-primary hover:text-primary-foreground">
                    {currentUpdate.version}
                  </Badge>
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
                className="nav-button"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={currentIndex === updates.length - 1}
                className="nav-button"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="modal-footer flex gap-2 pt-4">
            <Button
              variant="outline"
              className="action-button flex-1"
              onClick={handleDismissAll}
            >
              {t("dismiss_all")}
            </Button>
            <Button className="action-button flex-1" onClick={handleClose}>
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
              className={`progress-dot h-2 w-2 rounded-full transition-all duration-300 ${
                index === currentIndex ? "bg-primary scale-125" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
