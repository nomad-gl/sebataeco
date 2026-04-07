import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import Footer from "./components/Footer";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Practice from "./pages/Practice";
import Admin from "./pages/Admin";
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
import SchoolCalendar from "./pages/SchoolCalendar";
import LessonPlanner from "./pages/LessonPlanner";
import Settings from "./pages/Settings";
import PwaInstallBanner from "./components/PwaInstallBanner";
import UpdateBanner from "./components/UpdateBanner";
import FirstLaunchLanguagePicker from "./components/FirstLaunchLanguagePicker";
import CatalanDialectDetector from "./components/CatalanDialectDetector";

function Router() {
  return (
    <div className="min-h-screen flex flex-col">
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/chat" component={Chat} />
        <Route path="/practice" component={Practice} />
        <Route path="/admin" component={Admin} />
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
        <Route path="/forum" component={Forum} />
        <Route path="/school-calendar" component={SchoolCalendar} />
        <Route path="/lesson-planner" component={LessonPlanner} />
        <Route path="/settings" component={Settings} />
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
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
