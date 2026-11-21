import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { TempleArt } from '../components/TempleArt';
import { WelcomePage } from '../features/auth/WelcomePage';
import { LessonPage } from '../features/exercises/LessonPage';
import { ProfilePage } from '../features/progress/ProfilePage';
import { ProgressPage } from '../features/progress/ProgressPage';
import { ProgressProvider, useProgress } from '../features/progress/ProgressContext';
import { MapPage } from '../features/topics/MapPage';
import { AuthProvider, useSession } from '../features/auth/AuthContext';
import { LoginPage } from '../features/auth/LoginPage';
import { authClient } from '../lib/auth';
import { DailySyncStatus } from '../features/wellbeing/DailySyncStatus';

export function App() {
  return <AuthProvider><AuthenticatedApp /></AuthProvider>;
}

function AuthenticatedApp() {
  const session = useSession();
  if (!session) return <LoginPage />;
  return (
    <ProgressProvider key={session.user.id}>
      <div className="session-bar"><span>{session.user.email}</span><button type="button" className="btn btn-secondary" onClick={() => { void authClient().then((client) => client.auth.signOut({ scope: 'local' })); }}>Cerrar sesión</button></div>
      <DailySyncStatus />
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
