/**
 * BulkTeacherImport — Import teachers from CSV file
 * Allows directors to bulk import teachers with school assignments
 */

import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { useToast } from "../../components/ui/use-toast";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Loader2, Upload, Download, AlertCircle } from "lucide-react";

type CSVTeacher = {
  name: string;
  email?: string;
  schoolName?: string;
  weeklyHours?: number;
};

export function BulkTeacherImport({ calendarId }: { calendarId: number }) {
  const { toast } = useToast();
  const [csvContent, setCsvContent] = useState("");
  const [teachers, setTeachers] = useState<CSVTeacher[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "importing">("upload");
  const [errors, setErrors] = useState<string[]>([]);

  // Mutations
  const validateMutation = trpc.bulkTeacherImport.validateCSV.useMutation({
    onSuccess: (data) => {
      if (data.errors.length > 0) {
        setErrors(data.errors);
        toast({
          title: "Validation completed with warnings",
          description: `${data.teacherCount} valid teachers found, ${data.errorCount} errors`,
        });
      }
      setTeachers(data.teachers);
      setStep("preview");
    },
    onError: (error) => {
      toast({ title: "Validation failed", description: error.message, variant: "destructive" });
    },
  });

  const importMutation = trpc.bulkTeacherImport.importTeachers.useMutation({
    onSuccess: (result) => {
      toast({
        title: "Import completed",
        description: `${result.created} teachers imported, ${result.failed} failed`,
      });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
    };
    reader.readAsText(file);
  };

  const handleValidate = () => {
    if (!csvContent.trim()) {
      toast({ title: "Error", description: "Please select a CSV file", variant: "destructive" });
      return;
    }
    validateMutation.mutate({ csvContent });
  };

  const handleImport = () => {
    if (teachers.length === 0) {
      toast({ title: "Error", description: "No teachers to import", variant: "destructive" });
      return;
    }
    setStep("importing");
    importMutation.mutate({ teachers, calendarId });
  };

  const resetForm = () => {
    setCsvContent("");
    setTeachers([]);
    setErrors([]);
    setStep("upload");
  };

  const downloadTemplate = () => {
    const template = "name,email,school,hours\nJoan Martínez,joan@example.com,Escola A,25\nMaria García,maria@example.com,Escola B,20";
    const element = document.createElement("a");
    element.setAttribute("href", `data:text/csv;charset=utf-8,${encodeURIComponent(template)}`);
    element.setAttribute("download", "teacher_import_template.csv");
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Bulk Teacher Import</h2>
        <Button variant="outline" onClick={downloadTemplate} className="gap-2">
          <Download size={16} />
          Download Template
        </Button>
      </div>

      {/* Upload Step */}
      {step === "upload" && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="mx-auto mb-4 text-gray-400" size={32} />
              <p className="mb-4 text-gray-600">Drag and drop your CSV file or click to browse</p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload">
                <Button as="span" variant="outline">
                  Select CSV File
                </Button>
              </label>
            </div>

            {csvContent && (
              <div className="p-4 bg-blue-50 rounded text-sm">
                <p className="font-semibold">File loaded ({csvContent.length} bytes)</p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setCsvContent("");
                  setErrors([]);
                }}
                disabled={!csvContent}
              >
                Clear
              </Button>
              <Button
                onClick={handleValidate}
                disabled={!csvContent || validateMutation.isPending}
              >
                {validateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Validate CSV
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Preview Step */}
      {step === "preview" && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Preview ({teachers.length} teachers)</h3>
              {errors.length > 0 && (
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertCircle size={16} />
                  <span>{errors.length} validation warnings</span>
                </div>
              )}
            </div>

            {/* Teachers Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Email</th>
                    <th className="text-left p-2">School</th>
                    <th className="text-left p-2">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.slice(0, 10).map((teacher, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="p-2">{teacher.name}</td>
                      <td className="p-2">{teacher.email || "-"}</td>
                      <td className="p-2">{teacher.schoolName || "-"}</td>
                      <td className="p-2">{teacher.weeklyHours || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {teachers.length > 10 && (
                <p className="text-sm text-gray-600 p-2">... and {teachers.length - 10} more</p>
              )}
            </div>

            {/* Errors */}
            {errors.length > 0 && (
              <div className="p-4 bg-amber-50 rounded text-sm space-y-2">
                <p className="font-semibold text-amber-900">Validation Warnings:</p>
                {errors.map((error, idx) => (
                  <p key={idx} className="text-amber-800">
                    • {error}
                  </p>
                ))}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={importMutation.isPending}>
                {importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import {teachers.length} Teachers
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Importing Step */}
      {step === "importing" && (
        <Card className="p-6 text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin" />
          <p className="text-lg font-semibold">Importing teachers...</p>
        </Card>
      )}
    </div>
  );
}
