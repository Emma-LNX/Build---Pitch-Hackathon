import { api, ApiError } from '../../lib/auth';
import type { Profile } from '../../types';

export interface RemoteStudent {
  id: string; alias: string; schoolGrade: string | null; timeZone: string;
}

export async function linkStudent(accountId: string, profile: Profile): Promise<Profile> {
  let remote: RemoteStudent;
  try { remote = await api<RemoteStudent>(accountId, '/students/me'); }
  catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
    try {
      remote = await api<RemoteStudent>(accountId, '/students/me', {
        method: 'POST', body: JSON.stringify({ alias: profile.name, schoolGrade: profile.grade }),
      });
    } catch (creationError) {
      if (!(creationError instanceof ApiError) || creationError.status !== 409) throw creationError;
      remote = await api<RemoteStudent>(accountId, '/students/me');
    }
  }
  if (remote.alias !== profile.name || remote.schoolGrade !== profile.grade) {
    remote = await api<RemoteStudent>(accountId, '/students/me', {
      method: 'PATCH', body: JSON.stringify({ alias: profile.name, schoolGrade: profile.grade }),
    });
  }
  return { ...profile, studentId: remote.id, authUserId: accountId, timeZone: remote.timeZone };
}
