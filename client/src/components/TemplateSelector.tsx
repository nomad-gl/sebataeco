/**
 * TemplateSelector.tsx
 *
 * Component for selecting and loading templates on Create page
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Download, Save } from "lucide-react";
import { TemplatePreviewModal, type TemplateData } from "./TemplatePreviewModal";

interface TemplateSelectorProps {
  materialType: string;
  templates: TemplateData[];
  isLoading?: boolean;
  onLoadTemplate: (template: TemplateData) => void;
  onSaveAsTemplate: () => void;
  canSaveAsTemplate?: boolean;
}

export function TemplateSelector({
  materialType,
  templates,
  isLoading = false,
  onLoadTemplate,
  onSaveAsTemplate,
  canSaveAsTemplate = true,
}: TemplateSelectorProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateData | null>(null);

  // Filter templates by material type
  const filteredTemplates = templates.filter(
    (t) => t.type === materialType
  );

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = filteredTemplates.find((t) => t.id.toString() === templateId);
    if (template) {
      setPreviewTemplate(template);
      setShowPreview(true);
    }
  };

  const handleUseTemplate = () => {
    if (previewTemplate) {
      onLoadTemplate(previewTemplate);
      setShowPreview(false);
      setSelectedTemplateId("");
    }
  };

  return (
    <>
      <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/30">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Templates</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSaveAsTemplate}
            disabled={!canSaveAsTemplate || isLoading}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            Save as Template
          </Button>
        </div>

        {filteredTemplates.length > 0 ? (
          <div className="flex gap-2">
            <Select value={selectedTemplateId} onValueChange={handleSelectTemplate}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                {filteredTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id.toString()}>
                    <div className="flex flex-col">
                      <span>{template.name}</span>
                      {template.description && (
                        <span className="text-xs text-muted-foreground">
                          {template.description}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={() => handleSelectTemplate(selectedTemplateId)}
              disabled={!selectedTemplateId || isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Load
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No templates available for {materialType}. Create one by saving your first material as a template.
          </p>
        )}
      </div>

      {/* Template Preview Modal */}
      <TemplatePreviewModal
        template={previewTemplate}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onUse={handleUseTemplate}
        isLoading={isLoading}
      />
    </>
  );
}
