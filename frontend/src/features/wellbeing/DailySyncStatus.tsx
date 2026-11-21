import { useEffect, useState } from 'react';
import { useAccountId } from '../auth/AuthContext';
import { useProgress } from '../progress/ProgressContext';
import { getDB } from '../../offline/storage/db';
import { syncDailyCheckIns } from '../../offline/sync/dailyCheckIns';

export function DailySyncStatus() {
  const accountId = useAccountId();
  const { profile } = useProgress();
  const [pending, setPending] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    const update = () => { void getDB(accountId).then((db) => db.getAll('dailyCheckIns')).then((entries) => {
      if (!cancelled) {
        const pendingEntries = entries.filter((entry) => !entry.synced && entry.studentId === profile?.studentId);
        setPending(pendingEntries.length);
        setError(pendingEntries.find((entry) => entry.syncError)?.syncError ?? '');
      }
    }).catch(() => {}); };
    update();
    window.addEventListener('daily-check-in-changed', update);
    return () => { cancelled = true; window.removeEventListener('daily-check-in-changed', update); };
  }, [accountId, profile?.studentId]);
  if (!pending || !profile) return null;
  return <aside className="session-bar" aria-label="Sincronización de respuestas">
    <span role="status">{pending} {pending === 1 ? 'registro pendiente' : 'registros pendientes'} de enviar</span>
    <button type="button" className="btn btn-secondary" onClick={() => {
      setError(''); void syncDailyCheckIns(accountId, profile).catch((e: Error) => setError(e.message));
    }}>Reintentar envío</button>
    {error && <span role="alert">{error}</span>}
  </aside>;
}
