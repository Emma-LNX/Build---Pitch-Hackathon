import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { TempleArt } from '../components/TempleArt';
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
      <Route path="leccion/:lessonId" element={<LessonPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
