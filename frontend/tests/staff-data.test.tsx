import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError, OfflineError } from '../src/lib/api';
import { useRemote } from '../src/features/staff/ui';

afterEach(cleanup);

describe('aislamiento de datos remotos', () => {
  it('descarta respuestas tardías de otro colegio aunque el transporte ignore abort', async () => {
    let resolveOld!: (value: string) => void;
    const old = new Promise<string>((resolve) => { resolveOld = resolve; });
    const { result, rerender } = renderHook(({ school }) =>
      useRemote(school, () => school === 'old' ? old : Promise.resolve('new-school')),
    { initialProps: { school: 'old' } });
    rerender({ school: 'new' });
    await waitFor(() => expect(result.current.data).toBe('new-school'));
    await act(async () => { resolveOld('private-old-school'); });
    expect(result.current.data).toBe('new-school');
  });

  it('retira los datos guardados en memoria si el servidor revoca el permiso', async () => {
    let denied = false;
    const { result } = renderHook(() => useRemote('school', async () => {
      if (denied) throw new ApiError(403, 'Sin permiso');
      return ['private-data'];
    }));
    await waitFor(() => expect(result.current.data).toEqual(['private-data']));
    denied = true;
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));
    expect(result.current.data).toBeUndefined();
    expect(result.current.updatedAt).toBeNull();
  });

  it('conserva la última consulta y su fecha si solo se pierde la conexión', async () => {
    let offline = false;
    const { result } = renderHook(() => useRemote('school', async () => {
      if (offline) throw new OfflineError();
      return ['downloaded-data'];
    }));
    await waitFor(() => expect(result.current.data).toEqual(['downloaded-data']));
    const updated = result.current.updatedAt;
    offline = true;
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toBeInstanceOf(OfflineError));
    expect(result.current.data).toEqual(['downloaded-data']);
    expect(result.current.updatedAt).toEqual(updated);
  });
});
