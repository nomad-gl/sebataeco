import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import Footer from "./components/Footer";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import LocalLogin from "./pages/LocalLogin";
import RegisterWithInvite from "./pages/RegisterWithInvite";
import ResetPassword from "./pages/ResetPassword";
import OfflineBanner from "./components/OfflineBanner";
import Chat from "./pages/Chat";
import Practice from "./pages/Practice";
import Admin from "./pages/Admin";
import AdminErrors from "./pages/AdminErrors";
import Create from "./pages/Create";
import MyMaterials from "./pages/MyMaterials";
import MaterialView from "./pages/MaterialView";
import Progress from "./pages/Progress";
import Challenge from "./pages/Challenge";
import SampleQuestions from "./pages/SampleQuestions";
import Join from "./pages/Join";
import Presentation from "./pages/Presentation";
import Groups from "./pages/Groups";
import StudentProgress from "./pages/StudentProgress";
import GroupProgress from "./pages/GroupProgress";
import CompetencyDetail from "./pages/CompetencyDetail";
import Forum from "./pages/Forum";
import SebaConnect from "./pages/SebaConnect";
import SchoolCalendar from "./pages/SchoolCalendar";
import LessonPlanner from "./pages/LessonPlanner";
import Help from "./pages/Help";
import Settings from "./pages/Settings";
import Accountability from "./pages/Accountability";
import AuditDashboard from "./pages/AuditDashboard";
import Privacy from "./pages/Privacy";
import PwaInstallBanner from "./components/PwaInstallBanner";
import { BackToTop } from "./components/BackToTop";
import UpdateBanner from "./components/UpdateBanner";
import FirstLaunchLanguagePicker from "./components/FirstLaunchLanguagePicker";
import CatalanDialectDetector from "./components/CatalanDialectDetector";
import DataNoticeBanner from "./components/DataNoticeBanner";
import DpaAcceptanceDialog from "./components/DpaAcceptanceDialog";
import WhatsNewBanner from "./components/WhatsNewBanner";
import Dpa from "./pages/Dpa";
import AiModels from "./pages/AiModels";
import Paraula from "./pages/Paraula";
import ParaulaPractice from "./pages/ParaulaPractice";
import DirectorOverview from "./pages/director/DirectorOverview";
import DirectorStaff from "./pages/director/DirectorStaff";
import DirectorCurriculum from "./pages/director/DirectorCurriculum";
import DirectorStudentProgress from "./pages/director/DirectorStudentProgress";
import DirectorReports from "./pages/director/DirectorReports";
import DirectorSettings from "./pages/director/DirectorSettings";
import DirectorUsers from "./pages/director/DirectorUsers";
import HosProgress from "./pages/hos/HosProgress";
import HosGroups from "./pages/hos/HosGroups";
import HosTimetable from "./pages/hos/HosTimetable";
import HosAttendance from "./pages/hos/HosAttendance";
import HosAssessmentCalendar from "./pages/hos/HosAssessmentCalendar";
import HosCurriculum from "./pages/hos/HosCurriculum";
import HosReports from "./pages/hos/HosReports";
import HosSettings from "./pages/hos/HosSettings";
import SituacioGenerator from "./pages/SituacioGenerator";
import MySituacions from "./pages/MySituacions";
import AdminEnrolment from "./pages/admin/AdminEnrolment";
import AdminFinance from "./pages/admin/AdminFinance";
import AdminStaff from "./pages/admin/AdminStaff";
import AdminDocuments from "./pages/admin/AdminDocuments";
import AdminGovernance from "./pages/admin/AdminGovernance";
import AdminFacilities from "./pages/admin/AdminFacilities";
import AdminWakeWords from "./pages/admin/AdminWakeWords";
import AdminAudioResponses from "./pages/admin/AdminAudioResponses";
import AttendanceRegister from "./pages/AttendanceRegister";
import { useAuth } from "./_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { toast } from "sonner";
import { useI18n } from "./contexts/I18nContext";
import { GlobalCallListener } from "./components/GlobalCallListener";

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
        <Route path="/my-situacions">
          <HosOrAdminRoute component={MySituacions} />
        </Route>
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
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
