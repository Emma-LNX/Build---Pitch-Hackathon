import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AppLayout } from '../components/AppLayout';
import { TempleArt } from '../components/TempleArt';
import { DiagnosticPage } from '../features/adaptive/DiagnosticPage';
import { MissionPage } from '../features/adaptive/MissionPage';
import { TeacherPage } from '../features/adaptive/TeacherPage';
import { LoginPage } from '../features/auth/LoginPage';
import { WelcomePage } from '../features/auth/WelcomePage';
import { LessonPage } from '../features/exercises/LessonPage';
import { ProfilePage } from '../features/progress/ProfilePage';
import { ProgressPage } from '../features/progress/ProgressPage';
import { ProgressProvider, useProgress } from '../features/progress/ProgressContext';
import { MapPage } from '../features/topics/MapPage';
import { AuthProvider, useSession } from '../features/auth/AuthContext';

import { authClient } from '../lib/auth';
import { DailySyncStatus } from '../features/wellbeing/DailySyncStatus';
import { DailyCheckInGate } from '../features/wellbeing/DailyCheckInGate';

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
        <Route path="entrar" element={<Navigate to="/" replace />} />
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
      <Route path="entrar" element={<Navigate to="/" replace />} />
      <Route path="leccion/:lessonId" element={<LessonPage />} />
      <Route path="diagnostico" element={<DailySession id="diagnostico"><DiagnosticPage /></DailySession>} />
      <Route path="mision" element={<DailySession id="mision"><MissionPage /></DailySession>} />
      <Route path="profesor" element={<TeacherPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function DailySession({ id, children }: { id: string; children: ReactNode }) {
  const { profile } = useProgress();
  if (!profile) return <Navigate to="/" replace />;
  return <DailyCheckInGate studentId={profile.studentId} lessonId={id}>{children}</DailyCheckInGate>;
}
