import { NavLink, Outlet } from 'react-router-dom';
import { useProgress } from '../features/progress/ProgressContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { ChartIcon, CloudOffIcon, PersonIcon, TempleIcon } from './icons';

export function AppLayout() {
  return (
    <div className="app-shell">
      <ConnectionBanner />
      <main className="app-content">
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="Navegación principal">
        <NavLink to="/perfil" className="nav-item">
          <PersonIcon className="nav-icon" />
          <span>Perfil</span>
        </NavLink>
        <NavLink to="/" end className="nav-item">
          <TempleIcon className="nav-icon" />
          <span>Aventura</span>
        </NavLink>
        <NavLink to="/progreso" className="nav-item">
          <ChartIcon className="nav-icon" />
          <span>Progreso</span>
        </NavLink>
      </nav>
    </div>
  );
}

function ConnectionBanner() {
  const online = useOnlineStatus();
  const { pending } = useProgress();
  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      <CloudOffIcon className="offline-icon" />
      <span>
        Sin internet. ¡Puedes seguir jugando! Tu avance se guarda aquí
        {pending > 0 ? ` (${pending} por enviar)` : ''}.
      </span>
    </div>
  );
}
