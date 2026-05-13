import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Upload, AlertTriangle, CheckCircle, History, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export default function SubjectAssignmentManager() {
  const { t } = useI18n();
  const [csvContent, setCsvContent] = useState("");
  const [validationResult, setValidationResult] = useState<any>(null);
  const [conflictCheck, setConflictCheck] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // tRPC mutations and queries
  const validateCsvMutation = trpc.subjectAssignment.validateCsvImport.useMutation();
  const detectConflictsMutation = trpc.subjectAssignment.detectConflicts.useMutation();
  const bulkImportMutation = trpc.subjectAssignment.bulkImportAssignments.useMutation();
  const historyQuery = trpc.subjectAssignment.getAssignmentHistory.useQuery({});
  const recentImportsQuery = trpc.subjectAssignment.getRecentImports.useQuery({});
  const rollbackMutation = trpc.subjectAssignment.rollbackAssignments.useMutation();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);

      // Validate CSV
      setIsProcessing(true);
      try {
        const result = await validateCsvMutation.mutateAsync({ csvContent: content });
        setValidationResult(result);
        toast.success(`CSV validated: ${result.totalRecords} records found`);

        // Check for conflicts
        const conflicts = await detectConflictsMutation.mutateAsync({
          assignments: result.validRecords,
        });
        setConflictCheck(conflicts);

        if (conflicts.hasConflicts) {
          toast.warning(`Found ${conflicts.conflicts.length} potential conflicts`);
        }
      } catch (error) {
        toast.error(`CSV validation failed: ${(error as Error).message}`);
        setValidationResult(null);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async (allowConflicts: boolean = false) => {
    if (!validationResult?.validRecords) {
      toast.error("No valid records to import");
      return;
    }

    setIsProcessing(true);
    try {
      const result = await bulkImportMutation.mutateAsync({
        assignments: validationResult.validRecords,
        allowConflicts,
      });

      toast.success(
        `Import completed: ${result.successCount}/${result.totalProcessed} assignments processed`
      );

      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} errors occurred during import`);
      }

      // Reset form
      setCsvContent("");
      setValidationResult(null);
      setConflictCheck(null);

      // Refresh history
      historyQuery.refetch();
    } catch (error) {
      toast.error(`Import failed: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRollback = async (importId: string) => {
    if (!confirm("Are you sure you want to rollback this import? This action cannot be undone.")) {
      return;
    }

    setIsProcessing(true);
    try {
      const result = await rollbackMutation.mutateAsync({ importId });
      toast.success(result.message);
      historyQuery.refetch();
      recentImportsQuery.refetch();
    } catch (error) {
      toast.error(`Rollback failed: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Subject Assignment Manager</h1>
          <p className="text-slate-400">Manage bulk subject assignments with conflict detection and rollback</p>
        </div>

        <Tabs defaultValue="import" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="import">Import Assignments</TabsTrigger>
            <TabsTrigger value="history">Assignment History</TabsTrigger>
            <TabsTrigger value="rollback">Rollback</TabsTrigger>
          </TabsList>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Upload className="w-5 h-5" />
                  Upload CSV File
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    disabled={isProcessing}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <div className="text-slate-400 hover:text-slate-300">
                      <p className="text-lg font-semibold mb-2">Click to upload CSV</p>
                      <p className="text-sm">Expected format: teacher_name, subject_code, classroom, semester, sessions_per_week</p>
                    </div>
                  </label>
                </div>

                {/* Validation Results */}
                {validationResult && (
                  <div className="space-y-4">
                    <Alert className="bg-green-900 border-green-700">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <AlertDescription className="text-green-200">
                        CSV validation successful: {validationResult.totalRecords} records found
                      </AlertDescription>
                    </Alert>

                    {/* Conflict Warning */}
                    {conflictCheck?.hasConflicts && (
                      <Alert className="bg-amber-900 border-amber-700">
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                        <AlertDescription className="text-amber-200">
                          <p className="font-semibold mb-2">Conflicts detected:</p>
                          <ul className="text-sm space-y-1">
                            {conflictCheck.conflicts.map((conflict: any, idx: number) => (
                              <li key={idx}>
                                • {conflict.type}: {conflict.message}
                              </li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Records Preview */}
                    <div>
                      <h3 className="text-white font-semibold mb-3">Records to Import</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-slate-300">
                          <thead className="bg-slate-700">
                            <tr>
                              <th className="px-4 py-2 text-left">Teacher</th>
                              <th className="px-4 py-2 text-left">Subject</th>
                              <th className="px-4 py-2 text-left">Classroom</th>
                              <th className="px-4 py-2 text-left">Semester</th>
                              <th className="px-4 py-2 text-left">Sessions/Week</th>
                            </tr>
                          </thead>
                          <tbody>
                            {validationResult.validRecords.slice(0, 10).map((record: any, idx: number) => (
                              <tr key={idx} className="border-t border-slate-700">
                                <td className="px-4 py-2">{record.teacherName}</td>
                                <td className="px-4 py-2">{record.subjectCode}</td>
                                <td className="px-4 py-2">{record.classroom}</td>
                                <td className="px-4 py-2">{record.semester}</td>
                                <td className="px-4 py-2">{record.sessionsPerWeek}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {validationResult.validRecords.length > 10 && (
                          <p className="text-slate-400 text-sm mt-2">
                            ... and {validationResult.validRecords.length - 10} more records
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Import Buttons */}
                    <div className="flex gap-3 pt-4">
                      <Button
                        onClick={() => handleImport(false)}
                        disabled={isProcessing || conflictCheck?.hasConflicts}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Import Assignments
                      </Button>
                      {conflictCheck?.hasConflicts && (
                        <Button
                          onClick={() => handleImport(true)}
                          disabled={isProcessing}
                          variant="outline"
                          className="border-amber-600 text-amber-400 hover:bg-amber-900"
                        >
                          Import Anyway (Allow Conflicts)
                        </Button>
                      )}
                      <Button
                        onClick={() => {
                          setCsvContent("");
                          setValidationResult(null);
                          setConflictCheck(null);
                        }}
                        variant="outline"
                        disabled={isProcessing}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <History className="w-5 h-5" />
                  Assignment History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {historyQuery.isLoading ? (
                  <p className="text-slate-400">Loading history...</p>
                ) : historyQuery.data?.history.length === 0 ? (
                  <p className="text-slate-400">No assignment history yet</p>
                ) : (
                  <div className="space-y-3">
                    {historyQuery.data?.history.map((record: any) => (
                      <div key={record.id} className="bg-slate-700 p-4 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <Badge className="mb-2">{record.action}</Badge>
                            <p className="text-white font-semibold">Teacher ID: {record.teacher_id}</p>
                            {record.newValue && (
                              <p className="text-slate-300 text-sm mt-1">
                                {JSON.stringify(record.newValue).substring(0, 100)}...
                              </p>
                            )}
                            <p className="text-slate-500 text-xs mt-2">
                              {new Date(record.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rollback Tab */}
          <TabsContent value="rollback" className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <RotateCcw className="w-5 h-5" />
                  Rollback Imports
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentImportsQuery.isLoading ? (
                  <p className="text-slate-400">Loading recent imports...</p>
                ) : recentImportsQuery.data?.length === 0 ? (
                  <p className="text-slate-400">No recent imports to rollback</p>
                ) : (
                  <div className="space-y-3">
                    {recentImportsQuery.data?.map((imp: any) => (
                      <div key={imp.data?.importId} className="bg-slate-700 p-4 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-white font-semibold">Import ID: {imp.data?.importId}</p>
                            <p className="text-slate-300 text-sm">
                              {imp.data?.total} assignments imported
                            </p>
                            <p className="text-slate-500 text-xs mt-2">
                              {new Date(imp.created_at).toLocaleString()}
                            </p>
                          </div>
                          <Button
                            onClick={() => handleRollback(imp.data?.importId)}
                            disabled={isProcessing}
                            variant="destructive"
                            size="sm"
                          >
                            Rollback
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
