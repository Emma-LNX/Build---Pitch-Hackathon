import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { TempleArt } from '../components/TempleArt';
import { DiagnosticPage } from '../features/adaptive/DiagnosticPage';
import { MissionPage } from '../features/adaptive/MissionPage';
import { LoginPage } from '../features/auth/LoginPage';
import { WelcomePage } from '../features/auth/WelcomePage';
import { LessonPage } from '../features/exercises/LessonPage';
import { ProfilePage } from '../features/progress/ProfilePage';
import { ProgressPage } from '../features/progress/ProgressPage';
import { ProgressProvider, useProgress } from '../features/progress/ProgressContext';
import { MapPage } from '../features/topics/MapPage';

export function App() {
  return (
    <ProgressProvider>
      <AppRoutes />
    </ProgressProvider>
  );
}

function AppRoutes() {
  const { ready, profile } = useProgress();

  if (!ready) {
    return (
      <div className="splash">
        <TempleArt world="tikal" className="splash-temple" />
      </div>
    );
  }

  if (!profile) {
    return (
      <Routes>
        <Route path="entrar" element={<LoginPage />} />
        <Route path="*" element={<WelcomePage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<MapPage />} />
        <Route path="perfil" element={<ProfilePage />} />
        <Route path="progreso" element={<ProgressPage />} />
      </Route>
      <Route path="bienvenida" element={<WelcomePage />} />
      <Route path="entrar" element={<LoginPage />} />
      <Route path="leccion/:lessonId" element={<LessonPage />} />
      <Route path="diagnostico" element={<DiagnosticPage />} />
      <Route path="mision" element={<MissionPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
