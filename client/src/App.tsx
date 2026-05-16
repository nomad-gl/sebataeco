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
import PasswordReminderBanner from "./components/PasswordReminderBanner";
import Chat from "./pages/Chat";
import Practice from "./pages/Practice";
import InfantilPractice from "./pages/InfantilPractice";
import InfantilEixos from "./pages/InfantilEixos";
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
import AcademicCalendar from "./pages/AcademicCalendar";
import TeacherTimetable from "./pages/TeacherTimetable";
import LessonPlanner from "./pages/LessonPlanner";
import Help from "./pages/Help";
import Settings from "./pages/Settings";
import Accountability from "./pages/Accountability";
import AuditDashboard from "./pages/AuditDashboard";
import SecurityAuditDashboard from "./pages/SecurityAuditDashboard";
import Privacy from "./pages/Privacy";
import PwaInstallBanner from "./components/PwaInstallBanner";
import { BackToTop } from "./components/BackToTop";
import UpdateBanner from "./components/UpdateBanner";
import FirstLaunchLanguagePicker from "./components/FirstLaunchLanguagePicker";
import CatalanDialectDetector from "./components/CatalanDialectDetector";
import DataNoticeBanner from "./components/DataNoticeBanner";
import DpaAcceptanceDialog from "./components/DpaAcceptanceDialog";
import WhatsNewBanner from "./components/WhatsNewBanner";
// import TeacherNotifications from "./pages/TeacherNotifications"; // Temporarily disabled due to missing dependencies
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
import DirectorApprovals from "./pages/director/DirectorApprovals";
import DirectorTeacherAttendance from "./pages/director/DirectorTeacherAttendance";
import DirectorTeacherProfiles from "./pages/director/DirectorTeacherProfiles";
import DirectorCoverRequests from "./pages/director/DirectorCoverRequests";
import DirectorNotifications from "./pages/director/DirectorNotifications";
import SubjectAssignmentManager from "./pages/director/SubjectAssignmentManager";
import StudentDirectory from "./pages/director/StudentDirectory";
import TeacherDirectory from "./pages/TeacherDirectory";
import StudentDetails from "./pages/director/StudentDetails";
import TeacherAttendance from "./pages/teacher/TeacherAttendance";
import RegisterPage from "./pages/RegisterPage";
import TeacherProfileView from "./pages/teacher/TeacherProfileView";
import HosProgress from "./pages/hos/HosProgress";
import HosGroups from "./pages/hos/HosGroups";
import HosTimetable from "./pages/hos/HosTimetable";
import HosAttendance from "./pages/hos/HosAttendance";
import HosAssessmentCalendar from "./pages/hos/HosAssessmentCalendar";
import HosCurriculum from "./pages/hos/HosCurriculum";
import HosReports from "./pages/hos/HosReports";
import HosSettings from "./pages/hos/HosSettings";
import HosAssignUsers from "./pages/hos/HosAssignUsers";
import HosAddTeacher from "./pages/hos/HosAddTeacher";
import SituacioGenerator from "./pages/SituacioGenerator";
import CustomSets from "./pages/CustomSets";
import MySituacions from "./pages/MySituacions";
import AdminEnrolment from "./pages/admin/AdminEnrolment";
import AdminFinance from "./pages/admin/AdminFinance";
import AdminStaff from "./pages/admin/AdminStaff";
import AdminDocuments from "./pages/admin/AdminDocuments";
import AdminGovernance from "./pages/admin/AdminGovernance";
import AdminFacilities from "./pages/admin/AdminFacilities";
import AdminWakeWords from "./pages/admin/AdminWakeWords";
import AdminDpia from "./pages/admin/AdminDpia";
import AdminSecurityDashboard from "./pages/admin/AdminSecurityDashboard";
import AdminAudioResponses from "./pages/admin/AdminAudioResponses";
import AttendanceRegister from "./pages/AttendanceRegister";
import IndividualPlans from "./pages/IndividualPlans";
import SchoolManagement from "./pages/TenantManagement";
import RoleManagement from "./pages/RoleManagement";
import AdminUserManagement from "./pages/AdminUserManagement";
import TerritorialDirectorOverview from "./pages/TerritorialDirectorOverview";
import DirectorInviteAccept from "./pages/DirectorInviteAccept";
import TeacherInviteAccept from "./pages/TeacherInviteAccept";
import ChangePassword from "./pages/ChangePassword";
import MfaSetup from "./pages/MfaSetup";
import { useAuth } from "./_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { toast } from "sonner";
import { useI18n } from "./contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { GlobalCallListener } from "./components/GlobalCallListener";
import { useCrossOriginAuth } from "./hooks/useCrossOriginAuth";

/** Silently redeems a cross-origin SSO token if present in the URL. */
function CrossOriginAuthHandler() {
  useCrossOriginAuth();
  return null;
}

/**
 * Global guard: if the authenticated user has mustChangePassword=true,
 * redirect them to /change-password regardless of which route they visit.
 * Public routes (login, invite, change-password itself) are exempt.
 */
const EXEMPT_PATHS = ["/login", "/change-password", "/reset-password", "/register"];

function MustChangePasswordGuard() {
  const { user, loading } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (!(user as any).mustChangePassword) return;
    const isExempt = EXEMPT_PATHS.some(p => location.startsWith(p)) || location.startsWith("/invite/");
    if (!isExempt) navigate("/change-password");
  }, [loading, user, location, navigate]);

  return null;
}

/** Wraps a component and redirects to / with a toast if the user lacks admin or head_of_study role.
 * ZER directors who have opted in to act as HoS are also permitted. */
function HosOrAdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const { t } = useI18n();
  // Query ZER status so ZER directors can access HoS routes
  const { data: zerStatus, isLoading: zerLoading } = trpc.director.getZerStatus.useQuery(undefined, {
    enabled: !!user && user.role === "director",
    staleTime: 60_000,
  });
  const isZerHos = !!zerStatus?.isZer && !!zerStatus?.zerActsAsHos && user?.role === "director";
  const hasPermission = !user || user.role === "admin" || user.role === "head_of_study" || isZerHos;
  const stillChecking = loading || (user?.role === "director" && zerLoading);

  useEffect(() => {
    if (!stillChecking && user && !hasPermission) {
      toast.error(t("situacio_no_permission"), { duration: 5000 });
      navigate("/");
    }
  }, [stillChecking, user, hasPermission, navigate, t]);

  if (stillChecking) return null;
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
        <Route path="/practice/custom-sets" component={CustomSets} />
        <Route path="/infantil/practice" component={InfantilPractice} />
        <Route path="/infantil/eixos" component={InfantilEixos} />
        <Route path="/admin" component={Admin} />
        <Route path="/admin/errors" component={AdminErrors} />
        <Route path="/admin/enrolment" component={AdminEnrolment} />
        <Route path="/admin/finance" component={AdminFinance} />
        <Route path="/admin/staff" component={AdminStaff} />
        <Route path="/admin/documents" component={AdminDocuments} />
        <Route path="/admin/governance" component={AdminGovernance} />
        <Route path="/admin/facilities" component={AdminFacilities} />
        <Route path="/admin/wake-words" component={AdminWakeWords} />
        <Route path="/admin/dpia" component={AdminDpia} />
        <Route path="/admin/security" component={AdminSecurityDashboard} />
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
        <Route path="/academic-calendar" component={AcademicCalendar} />
        <Route path="/teacher-timetable" component={TeacherTimetable} />
        <Route path="/school-calendar" component={SchoolCalendar} />
        <Route path="/lesson-planner" component={LessonPlanner} />
        <Route path="/help" component={Help} />
        <Route path="/settings" component={Settings} />
        <Route path="/accountability" component={Accountability} />
        <Route path="/audit" component={AuditDashboard} />
        <Route path="/security-audit" component={SecurityAuditDashboard} />
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
        <Route path="/director/approvals" component={DirectorApprovals} />
        <Route path="/director/teacher-attendance" component={DirectorTeacherAttendance} />
        <Route path="/director/teacher-profiles">
          <HosOrAdminRoute component={DirectorTeacherProfiles} />
        </Route>
        <Route path="/director/cover-requests" component={DirectorCoverRequests} />
        <Route path="/director/notifications" component={DirectorNotifications} />
        <Route path="/director/subject-assignments" component={SubjectAssignmentManager} />
        <Route path="/director/students/:id" component={StudentDetails} />
        <Route path="/director/students" component={StudentDirectory} />
        <Route path="/teacher/attendance" component={TeacherAttendance} />
        <Route path="/teacher/profile/:userId" component={TeacherProfileView} />
        <Route path="/teacher/profile" component={TeacherProfileView} />
        <Route path="/teacher/my-profile" component={TeacherProfileView} />
        <Route path="/teacher/directory" component={TeacherDirectory} />
        {/* <Route path="/teacher/notifications" component={TeacherNotifications} /> */}
        <Route path="/teacher/register" component={RegisterPage} />
        <Route path="/head-of-study/progress" component={HosProgress} />
        <Route path="/head-of-study/groups" component={HosGroups} />
        <Route path="/head-of-study/timetable" component={HosTimetable} />
        <Route path="/head-of-study/attendance" component={HosAttendance} />
        <Route path="/head-of-study/assessment-calendar" component={HosAssessmentCalendar} />
        <Route path="/head-of-study/curriculum" component={HosCurriculum} />
        <Route path="/head-of-study/reports" component={HosReports} />
        <Route path="/head-of-study/settings" component={HosSettings} />
        <Route path="/head-of-study/assign-users" component={HosAssignUsers} />
        <Route path="/head-of-study/add-teacher" component={HosAddTeacher} />
        <Route path="/situacio">
          <HosOrAdminRoute component={SituacioGenerator} />
        </Route>
        <Route path="/individual-plans" component={IndividualPlans} />
        <Route path="/seba/tenants" component={SchoolManagement} />
        <Route path="/seba/roles" component={RoleManagement} />
        <Route path="/seba/user-management" component={AdminUserManagement} />
        <Route path="/territorial/overview" component={TerritorialDirectorOverview} />
        <Route path="/invite/director/:token" component={DirectorInviteAccept} />
        <Route path="/invite/teacher/:token" component={TeacherInviteAccept} />
        <Route path="/change-password" component={ChangePassword} />
        <Route path="/settings/mfa" component={MfaSetup} />
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

/** Fires a personalised welcome toast once after a successful login. */
function WelcomeToast() {
  const { t } = useI18n();
  useEffect(() => {
    const name = sessionStorage.getItem("seba:welcome_name");
    if (name) {
      sessionStorage.removeItem("seba:welcome_name");
      // Small delay so the page has rendered before the toast appears
      setTimeout(() => {
        toast.success(t("signin_welcome_name").replace("{name}", name), {
          duration: 5000,
          position: "top-center",
        });
      }, 600);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <WelcomeToast />
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
          <PasswordReminderBanner />
          <CrossOriginAuthHandler />
          <MustChangePasswordGuard />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
