import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { TempleArt } from '../components/TempleArt';
import { AuthProvider, useAuth } from '../features/auth/AuthContext';
import { DiagnosticPage } from '../features/adaptive/DiagnosticPage';
import { MissionPage } from '../features/adaptive/MissionPage';
import { TeacherPage as LearningReviewPage } from '../features/adaptive/TeacherPage';
import { LoginPage } from '../features/auth/LoginPage';
import { LessonPage } from '../features/exercises/LessonPage';
import { ProfilePage } from '../features/progress/ProfilePage';
import { ProgressPage } from '../features/progress/ProgressPage';
import { ProgressProvider, useProgress } from '../features/progress/ProgressContext';
import { StaffApp } from '../features/staff/StaffApp';
import { MapPage } from '../features/topics/MapPage';
import { WardrobePage } from '../features/wardrobe/WardrobePage';
import { DailyCheckInGate } from '../features/wellbeing/DailyCheckInGate';

export function App() {
  return (
    <ProgressProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ProgressProvider>
  );
}

function AppRoutes() {
  const { ready, profile } = useProgress();
  const { status } = useAuth();

  if (!ready || status === 'loading') {
    return (
      <div className="splash">
        <TempleArt world="tikal" className="splash-temple" />
      </div>
    );
  }

  // Sin sesión abierta no se monta ninguna pantalla con datos de estudiantes
  if (status !== 'signed-in' || !profile) {
    return (
      <Routes>
        <Route path="profe/*" element={<StaffApp />} />
        <Route path="profesor/*" element={<Navigate to="/profe" replace />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<MapPage />} />
        <Route path="perfil" element={<ProfilePage />} />
        <Route path="perfil/guardarropa" element={<WardrobePage />} />
        <Route path="progreso" element={<ProgressPage />} />
      </Route>
      <Route path="leccion/:lessonId" element={<DailyCheckInGate><LessonPage /></DailyCheckInGate>} />
      <Route path="profe/*" element={<StaffApp />} />
      <Route path="profesor/*" element={<Navigate to="/profe" replace />} />
      <Route path="diagnostico" element={<DailyCheckInGate><DiagnosticPage /></DailyCheckInGate>} />
      <Route path="mision" element={<DailyCheckInGate><MissionPage /></DailyCheckInGate>} />
      <Route path="mi-aprendizaje" element={<LearningReviewPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
