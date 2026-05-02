import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowLeft,
  Clock,
  AlertTriangle,
  CheckCircle,
  Calendar,
  User,
  BookOpen,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface TeacherDetailViewProps {
  teacherId: number;
  onBack: () => void;
}

export default function TeacherDetailView({ teacherId, onBack }: TeacherDetailViewProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [showExcessWarning, setShowExcessWarning] = useState(false);
  const [warningAcknowledged, setWarningAcknowledged] = useState(false);

  // Fetch teacher data
  const { data: coverLessons, isLoading: coverLoading } = trpc.teacherCoverLessons.getCoverLessons.useQuery(
    { userId: teacherId }
  );

  const { data: absenceHistory, isLoading: absenceLoading } = trpc.teacherCoverLessons.getAbsenceHistory.useQuery(
    { userId: teacherId }
  );

  const { data: hourBalance, isLoading: balanceLoading } = trpc.teacherCoverLessons.getHourBalance.useQuery(
    { userId: teacherId }
  );

  const isLoading = coverLoading || absenceLoading || balanceLoading;

  // Show warning if hours are in excess
  const showWarning = hourBalance?.isExcess && !warningAcknowledged;

  const handleAcknowledgeWarning = () => {
    setWarningAcknowledged(true);
    setShowExcessWarning(false);
    toast.success(t("warning_acknowledged"));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      {/* Header with back button */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="outline" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-3xl font-bold">{t("teacher_details")}</h1>
      </div>

      {/* Excess hours warning */}
      {showWarning && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>{t("warning_excess_hours")}</strong>
            <p className="mt-2">
              {t("teacher_hours_exceed", {
                excess: hourBalance?.balanceHours.toFixed(2),
                weekly: hourBalance?.contractedHours,
              })}
            </p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => setShowExcessWarning(true)}
            >
              {t("acknowledge_warning")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Hour Balance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("own_lesson_hours")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hourBalance?.ownLessonHours.toFixed(1)}h</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("covered_lesson_hours")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hourBalance?.coveredLessonHours.toFixed(1)}h</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("contracted_hours")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hourBalance?.contractedHours}h</div>
          </CardContent>
        </Card>

        <Card className={hourBalance?.isExcess ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("hour_balance")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${hourBalance?.isExcess ? "text-red-600" : "text-green-600"}`}>
              {hourBalance?.isExcess ? "+" : ""}{hourBalance?.balanceHours.toFixed(1)}h
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different sections */}
      <Tabs defaultValue="cover-lessons" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cover-lessons">{t("cover_lessons")}</TabsTrigger>
          <TabsTrigger value="absence-history">{t("absence_history")}</TabsTrigger>
        </TabsList>

        {/* Cover Lessons Tab */}
        <TabsContent value="cover-lessons">
          <Card>
            <CardHeader>
              <CardTitle>{t("cover_lessons_provided")}</CardTitle>
            </CardHeader>
            <CardContent>
              {coverLessons && coverLessons.length > 0 ? (
                <div className="space-y-4">
                  {coverLessons.map((lesson) => (
                    <div key={lesson.id} className="flex items-start justify-between border-b pb-4 last:border-0">
                      <div className="flex-1">
                        <p className="font-semibold">{lesson.className}</p>
                        <p className="text-sm text-muted-foreground">
                          {t("covering_for")}: {lesson.absentTeacherName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <Calendar className="inline w-4 h-4 mr-1" />
                          {new Date(lesson.lessonDate).toLocaleDateString()}
                        </p>
                        {lesson.absenceReason && (
                          <Badge variant="outline" className="mt-2">
                            {lesson.absenceReason}
                          </Badge>
                        )}
                      </div>
                      <Badge
                        variant={lesson.status === "confirmed" ? "default" : "secondary"}
                        className="ml-4"
                      >
                        {lesson.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">{t("no_cover_lessons")}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Absence History Tab */}
        <TabsContent value="absence-history">
          <Card>
            <CardHeader>
              <CardTitle>{t("absence_history")}</CardTitle>
            </CardHeader>
            <CardContent>
              {absenceHistory && absenceHistory.length > 0 ? (
                <div className="space-y-4">
                  {absenceHistory.map((absence) => (
                    <div key={`${absence.type}-${absence.id}`} className="flex items-start justify-between border-b pb-4 last:border-0">
                      <div className="flex-1">
                        <p className="font-semibold">
                          {absence.type === "class_absence" ? t("class_absence") : t("absence_notification")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <Calendar className="inline w-4 h-4 mr-1" />
                          {new Date(absence.date).toLocaleDateString()}
                        </p>
                        {absence.className && (
                          <p className="text-sm text-muted-foreground">{absence.className}</p>
                        )}
                        {absence.reason && (
                          <p className="text-sm mt-2">{absence.reason}</p>
                        )}
                      </div>
                      <Badge
                        variant={
                          absence.status === "approved" || absence.status === true
                            ? "default"
                            : absence.status === "rejected" || absence.status === false
                            ? "destructive"
                            : "secondary"
                        }
                        className="ml-4"
                      >
                        {String(absence.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">{t("no_absences")}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Excess Hours Warning Dialog */}
      <Dialog open={showExcessWarning} onOpenChange={setShowExcessWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              {t("excess_hours_warning")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              {t("teacher_hours_exceed_detail", {
                name: "Teacher",
                excess: hourBalance?.balanceHours.toFixed(2),
                weekly: hourBalance?.contractedHours,
              })}
            </p>
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                {t("director_action_required")}
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExcessWarning(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleAcknowledgeWarning} className="bg-red-600 hover:bg-red-700">
              {t("acknowledge_warning")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
