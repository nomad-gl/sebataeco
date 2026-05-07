/**
 * AINA Creation Actions Component
 * Provides print, save, and download buttons for AINA chat creations
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Printer, Download, Copy, Save, FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { printAinaCreation, downloadAinaCreationAsText, downloadAinaCreationAsHtml, copyAinaCreationToClipboard } from "@/lib/ainaPrintUtils";

interface AinaCreationActionsProps {
  title: string;
  content: string;
  subject?: string;
  yearGroup?: string;
  competencies?: string[];
}

export function AinaCreationActions({
  title,
  content,
  subject = "General",
  yearGroup = "All",
  competencies = [],
}: AinaCreationActionsProps) {
  const { t } = useI18n();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveTitle, setSaveTitle] = useState(title);
  const [isSaving, setIsSaving] = useState(false);
  const saveMutation = trpc.lomloe.saveAinaCreationAsSituacio.useMutation();

  const handlePrint = () => {
    printAinaCreation({
      title,
      content,
      timestamp: new Date(),
    });
  };

  const handleDownloadText = () => {
    downloadAinaCreationAsText({
      title,
      content,
      timestamp: new Date(),
    });
    toast.success(t("download_success") || "Downloaded as text");
  };

  const handleDownloadHtml = () => {
    downloadAinaCreationAsHtml({
      title,
      content,
      timestamp: new Date(),
    });
    toast.success(t("download_success") || "Downloaded as HTML");
  };

  const handleCopy = () => {
    if (copyAinaCreationToClipboard({ title, content })) {
      toast.success(t("copy_success") || "Copied to clipboard");
    } else {
      toast.error(t("copy_error") || "Failed to copy");
    }
  };

  const handleSaveAsSituacio = async () => {
    if (!saveTitle.trim()) {
      toast.error(t("title_required") || "Title is required");
      return;
    }

    setIsSaving(true);
    try {
      // Parse content to extract situació structure if possible
      const resultJson = {
        title: saveTitle,
        context: content.split("\n").slice(0, 3).join("\n"),
        task: content.split("\n").slice(3, 6).join("\n") || content,
        competencies: competencies.map((code) => ({
          code,
          description: code,
        })),
        criteria: content.split("\n").filter((line) => line.trim().length > 0).slice(0, 5),
        activities: [
          {
            phase: "Main Activity",
            description: content,
          },
        ],
        lomloeRef: `AINA Generated · ${new Date().toLocaleDateString()}`,
      };

      await saveMutation.mutateAsync({
        title: saveTitle,
        topic: content.split("\n")[0] || "AINA Creation",
        subject,
        yearGroup,
        competencies,
        resultJson,
      });

      toast.success(t("saved_to_situacions") || "Saved to My Situacions");
      setShowSaveDialog(false);
    } catch (error) {
      console.error("Error saving situació:", error);
      toast.error(t("save_error") || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          onClick={handlePrint}
          className="gap-1.5"
          title={t("print") || "Print"}
        >
          <Printer className="w-3.5 h-3.5" />
          {t("print") || "Print"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={handleDownloadText}
          className="gap-1.5"
          title={t("download_as_text") || "Download as Text"}
        >
          <FileText className="w-3.5 h-3.5" />
          {t("download_text") || "Text"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={handleDownloadHtml}
          className="gap-1.5"
          title={t("download_as_html") || "Download as HTML"}
        >
          <Download className="w-3.5 h-3.5" />
          {t("download_html") || "HTML"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={handleCopy}
          className="gap-1.5"
          title={t("copy_to_clipboard") || "Copy to Clipboard"}
        >
          <Copy className="w-3.5 h-3.5" />
          {t("copy") || "Copy"}
        </Button>

        <Button
          size="sm"
          variant="default"
          onClick={() => setShowSaveDialog(true)}
          className="gap-1.5"
          title={t("save_to_situacions") || "Save to My Situacions"}
        >
          <Save className="w-3.5 h-3.5" />
          {t("save_situacio") || "Save"}
        </Button>
      </div>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("save_to_situacions") || "Save to My Situacions"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="save-title">{t("title") || "Title"}</Label>
              <Input
                id="save-title"
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                placeholder={t("enter_title") || "Enter title"}
                maxLength={256}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(false)}
                disabled={isSaving}
              >
                {t("cancel") || "Cancel"}
              </Button>
              <Button
                onClick={handleSaveAsSituacio}
                disabled={isSaving}
                className="gap-1.5"
              >
                {isSaving ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    {t("saving") || "Saving..."}
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    {t("save") || "Save"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
