import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import Footer from "./components/Footer";
import { ThemeProvider } from "./contexts/ThemeContext";
import OfflineBanner from "./components/OfflineBanner";
import PwaInstallBanner from "./components/PwaInstallBanner";
import { BackToTop } from "./components/BackToTop";
import UpdateBanner from "./components/UpdateBanner";
import FirstLaunchLanguagePicker from "./components/FirstLaunchLanguagePicker";
import CatalanDialectDetector from "./components/CatalanDialectDetector";
import DataNoticeBanner from "./components/DataNoticeBanner";
import DpaAcceptanceDialog from "./components/DpaAcceptanceDialog";
import WhatsNewBanner from "./components/WhatsNewBanner";
import { GlobalCallListener } from "./components/GlobalCallListener";
import { useAuth } from "./_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, lazy, Suspense } from "react";
import { toast } from "sonner";
import { useI18n } from "./contexts/I18nContext";

// ─── Lazy-loaded page routes ──────────────────────────────────────────────────
// Each page is split into its own chunk and only downloaded when first visited.

const Home                   = lazy(() => import("./pages/Home"));
const LocalLogin             = lazy(() => import("./pages/LocalLogin"));
const RegisterWithInvite     = lazy(() => import("./pages/RegisterWithInvite"));
const ResetPassword          = lazy(() => import("./pages/ResetPassword"));
const NotFound               = lazy(() => import("@/pages/NotFound"));

// Core teacher tools
const Chat                   = lazy(() => import("./pages/Chat"));
const Practice               = lazy(() => import("./pages/Practice"));
const Create                 = lazy(() => import("./pages/Create"));
const MyMaterials            = lazy(() => import("./pages/MyMaterials"));
const MaterialView           = lazy(() => import("./pages/MaterialView"));
const Progress               = lazy(() => import("./pages/Progress"));
const Challenge              = lazy(() => import("./pages/Challenge"));
const SampleQuestions        = lazy(() => import("./pages/SampleQuestions"));
const Join                   = lazy(() => import("./pages/Join"));
const Presentation           = lazy(() => import("./pages/Presentation"));
const Groups                 = lazy(() => import("./pages/Groups"));
const StudentProgress        = lazy(() => import("./pages/StudentProgress"));
const GroupProgress          = lazy(() => import("./pages/GroupProgress"));
const CompetencyDetail       = lazy(() => import("./pages/CompetencyDetail"));
const AttendanceRegister     = lazy(() => import("./pages/AttendanceRegister"));
const Forum                  = lazy(() => import("./pages/Forum"));
const SebaConnect            = lazy(() => import("./pages/SebaConnect"));
const SchoolCalendar         = lazy(() => import("./pages/SchoolCalendar"));
const LessonPlanner          = lazy(() => import("./pages/LessonPlanner"));
const Help                   = lazy(() => import("./pages/Help"));
const Settings               = lazy(() => import("./pages/Settings"));
const Accountability         = lazy(() => import("./pages/Accountability"));
const AuditDashboard         = lazy(() => import("./pages/AuditDashboard"));
const Privacy                = lazy(() => import("./pages/Privacy"));
const Dpa                    = lazy(() => import("./pages/Dpa"));
const AiModels               = lazy(() => import("./pages/AiModels"));
const Paraula                = lazy(() => import("./pages/Paraula"));
const ParaulaPractice        = lazy(() => import("./pages/ParaulaPractice"));
const IndividualPlans        = lazy(() => import("./pages/IndividualPlans"));

// Admin pages
const Admin                  = lazy(() => import("./pages/Admin"));
const AdminErrors            = lazy(() => import("./pages/AdminErrors"));
const AdminEnrolment         = lazy(() => import("./pages/admin/AdminEnrolment"));
const AdminFinance           = lazy(() => import("./pages/admin/AdminFinance"));
const AdminStaff             = lazy(() => import("./pages/admin/AdminStaff"));
const AdminDocuments         = lazy(() => import("./pages/admin/AdminDocuments"));
const AdminGovernance        = lazy(() => import("./pages/admin/AdminGovernance"));
const AdminFacilities        = lazy(() => import("./pages/admin/AdminFacilities"));
const AdminWakeWords         = lazy(() => import("./pages/admin/AdminWakeWords"));
const AdminAudioResponses    = lazy(() => import("./pages/admin/AdminAudioResponses"));

// Director pages
const DirectorOverview       = lazy(() => import("./pages/director/DirectorOverview"));
const DirectorStaff          = lazy(() => import("./pages/director/DirectorStaff"));
const DirectorCurriculum     = lazy(() => import("./pages/director/DirectorCurriculum"));
const DirectorStudentProgress = lazy(() => import("./pages/director/DirectorStudentProgress"));
const DirectorReports        = lazy(() => import("./pages/director/DirectorReports"));
const DirectorSettings       = lazy(() => import("./pages/director/DirectorSettings"));
const DirectorUsers          = lazy(() => import("./pages/director/DirectorUsers"));

// Head of Study pages
const HosProgress            = lazy(() => import("./pages/hos/HosProgress"));
const HosGroups              = lazy(() => import("./pages/hos/HosGroups"));
const HosTimetable           = lazy(() => import("./pages/hos/HosTimetable"));
const HosAttendance          = lazy(() => import("./pages/hos/HosAttendance"));
const HosAssessmentCalendar  = lazy(() => import("./pages/hos/HosAssessmentCalendar"));
const HosCurriculum          = lazy(() => import("./pages/hos/HosCurriculum"));
const HosReports             = lazy(() => import("./pages/hos/HosReports"));
const HosSettings            = lazy(() => import("./pages/hos/HosSettings"));

// HOS/Admin restricted pages
const SituacioGenerator      = lazy(() => import("./pages/SituacioGenerator"));
const MySituacions           = lazy(() => import("./pages/MySituacions"));

// ─── Route-level loading fallback ─────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

/** Wraps a component and redirects to / with a toast if the user lacks admin or head_of_study role. */
function HosOrAdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const { t } = useI18n();
  const hasPermission = !user || user.role === "admin" || user.role === "head_of_study";

  useEffect(() => {
    if (!loading && user && !hasPermission) {
      toast.error(t("situacio_no_permission"), { duration: 5000 });
      navigate("/");
    }
  }, [loading, user, hasPermission, navigate, t]);

  if (loading) return null;
  if (!hasPermission) return null;
  return <Component />;
}

function Router() {
  return (
    <div className="min-h-screen flex flex-col">
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/login" component={LocalLogin} />
          <Route path="/register" component={RegisterWithInvite} />
          <Route path="/reset-password" component={ResetPassword} />
          <Route path="/chat" component={Chat} />
          <Route path="/practice" component={Practice} />
          <Route path="/admin" component={Admin} />
          <Route path="/admin/errors" component={AdminErrors} />
          <Route path="/admin/enrolment" component={AdminEnrolment} />
          <Route path="/admin/finance" component={AdminFinance} />
          <Route path="/admin/staff" component={AdminStaff} />
          <Route path="/admin/documents" component={AdminDocuments} />
          <Route path="/admin/governance" component={AdminGovernance} />
          <Route path="/admin/facilities" component={AdminFacilities} />
          <Route path="/admin/wake-words" component={AdminWakeWords} />
          <Route path="/admin/audio-responses" component={AdminAudioResponses} />
          <Route path="/create" component={Create} />
          <Route path="/my-materials" component={MyMaterials} />
          <Route path="/materials/:id" component={MaterialView} />
          <Route path="/progress" component={Progress} />
          <Route path="/challenge" component={Challenge} />
          <Route path="/questions" component={SampleQuestions} />
          <Route path="/join" component={Join} />
          <Route path="/presentation" component={Presentation} />
          <Route path="/groups" component={Groups} />
          <Route path="/groups/:groupId/progress" component={GroupProgress} />
          <Route path="/groups/:groupId/student/:studentId" component={StudentProgress} />
          <Route path="/competency/:code" component={CompetencyDetail} />
          <Route path="/attendance" component={AttendanceRegister} />
          <Route path="/forum" component={Forum} />
          <Route path="/connect" component={SebaConnect} />
          <Route path="/school-calendar" component={SchoolCalendar} />
          <Route path="/lesson-planner" component={LessonPlanner} />
          <Route path="/help" component={Help} />
          <Route path="/settings" component={Settings} />
          <Route path="/accountability" component={Accountability} />
          <Route path="/audit" component={AuditDashboard} />
          <Route path="/privacy" component={Privacy} />
          <Route path="/dpa" component={Dpa} />
          <Route path="/ai-models" component={AiModels} />
          <Route path="/paraula" component={Paraula} />
          <Route path="/paraula-practice" component={ParaulaPractice} />
          <Route path="/director/overview" component={DirectorOverview} />
          <Route path="/director/staff" component={DirectorStaff} />
          <Route path="/director/curriculum" component={DirectorCurriculum} />
          <Route path="/director/progress" component={DirectorStudentProgress} />
          <Route path="/director/reports" component={DirectorReports} />
          <Route path="/director/settings" component={DirectorSettings} />
          <Route path="/director/users" component={DirectorUsers} />
          <Route path="/head-of-study/progress" component={HosProgress} />
          <Route path="/head-of-study/groups" component={HosGroups} />
          <Route path="/head-of-study/timetable" component={HosTimetable} />
          <Route path="/head-of-study/attendance" component={HosAttendance} />
          <Route path="/head-of-study/assessment-calendar" component={HosAssessmentCalendar} />
          <Route path="/head-of-study/curriculum" component={HosCurriculum} />
          <Route path="/head-of-study/reports" component={HosReports} />
          <Route path="/head-of-study/settings" component={HosSettings} />
          <Route path="/situacio">
            <HosOrAdminRoute component={SituacioGenerator} />
          </Route>
          <Route path="/individual-plans" component={IndividualPlans} />
          <Route path="/my-situacions">
            <HosOrAdminRoute component={MySituacions} />
          </Route>
          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <FirstLaunchLanguagePicker />
          <CatalanDialectDetector />
          <UpdateBanner />
          <PwaInstallBanner />
          <DataNoticeBanner />
          <DpaAcceptanceDialog />
          <WhatsNewBanner />
          <BackToTop />
          <GlobalCallListener />
          <OfflineBanner />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
