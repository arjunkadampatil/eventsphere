import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { AlertTriangle, CameraOff, CheckCircle2, Keyboard, ScanLine, XCircle } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { formatDate, formatTime } from '../lib/format';
import { EmptyState, PageHeader, Spinner } from '../components/ui';

const RESULT_STYLE = {
  ok: ['border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200', CheckCircle2],
  duplicate: ['border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200', AlertTriangle],
  error: ['border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200', XCircle],
};

export default function Scanner() {
  const [params, setParams] = useSearchParams();
  const eventId = params.get('event') ?? '';
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [result, setResult] = useState(null);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  const scanner = useRef(null);
  const last = useRef({ code: '', at: 0 });

  const events = useQuery({
    queryKey: ['manage-events', 'scannable'],
    queryFn: () => api.get('/api/events/manage?status=approved&limit=100'),
  });
  const scannable = (events.data?.items ?? [])
    .filter((e) => new Date(e.endsAt).getTime() > Date.now() - 6 * 60 * 60 * 1000)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

  useEffect(() => {
    if (!eventId && scannable.length) setParams({ event: scannable[0].id }, { replace: true });
  }, [eventId, scannable, setParams]);

  const submit = useCallback(
    async (code) => {
      const ticketCode = code.trim();
      if (!ticketCode || !eventId) return;
      const now = Date.now();
      if (last.current.code === ticketCode && now - last.current.at < 3000) return;
      last.current = { code: ticketCode, at: now };
      setBusy(true);
      try {
        const { attendee } = await api.post(`/api/events/${eventId}/check-in`, { ticketCode });
        setResult({ kind: 'ok', title: `Welcome, ${attendee.name}!`, text: attendee.email });
        setCount((n) => n + 1);
        navigator.vibrate?.(80);
      } catch (err) {
        const duplicate = err instanceof ApiError && err.status === 409;
        setResult({ kind: duplicate ? 'duplicate' : 'error', title: duplicate ? 'Already checked in' : 'Not valid', text: err.message });
        navigator.vibrate?.([60, 60, 60]);
      } finally {
        setBusy(false);
      }
    },
    [eventId],
  );

  const stopCamera = useCallback(async () => {
    const s = scanner.current;
    scanner.current = null;
    if (s?.isScanning) await s.stop().catch(() => {});
    setCameraOn(false);
  }, []);

  async function startCamera() {
    setCameraError('');
    try {
      const s = new Html5Qrcode('qr-reader', { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false });
      scanner.current = s;
      await s.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, (text) => submit(text), () => {});
      setCameraOn(true);
    } catch (err) {
      scanner.current = null;
      setCameraError(
        String(err).includes('NotAllowed')
          ? 'Camera permission was denied. Allow camera access, or type ticket codes below.'
          : 'No camera available on this device. Type ticket codes below instead.',
      );
    }
  }

  useEffect(() => () => void stopCamera(), [stopCamera]);

  const current = scannable.find((e) => e.id === eventId);
  const [style, Icon] = result ? RESULT_STYLE[result.kind] : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader title="Ticket scanner" subtitle="Point the camera at a student's QR ticket to check them in." />

      {events.isSuccess && scannable.length === 0 ? (
        <div className="card">
          <EmptyState icon={ScanLine} title="Nothing to scan right now" text="Approved events that are upcoming or ended in the last few hours show up here." />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="card p-5">
            <label htmlFor="scan-event" className="label">
              Event
            </label>
            <select id="scan-event" className="input" value={eventId} onChange={(e) => setParams({ event: e.target.value }, { replace: true })}>
              {scannable.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} · {formatDate(e.startsAt)} {formatTime(e.startsAt)}
                </option>
              ))}
            </select>
            {current && (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {current.registrationsCount} registered · {count} checked in this session
              </p>
            )}
          </div>

          <div className="card overflow-hidden">
            <div id="qr-reader" className={`mx-auto w-full max-w-md bg-slate-900 ${cameraOn ? '' : 'hidden'}`} />
            {!cameraOn && (
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                {cameraError ? <CameraOff className="h-10 w-10 text-slate-400" aria-hidden="true" /> : <ScanLine className="h-10 w-10 text-primary-600" aria-hidden="true" />}
                {cameraError && <p className="max-w-sm text-sm text-slate-600 dark:text-slate-400">{cameraError}</p>}
                <button type="button" className="btn btn-primary" onClick={startCamera} disabled={!eventId}>
                  Start camera
                </button>
              </div>
            )}
            {cameraOn && (
              <div className="flex justify-center p-3">
                <button type="button" className="btn btn-secondary btn-sm" onClick={stopCamera}>
                  Stop camera
                </button>
              </div>
            )}
          </div>

          <div aria-live="assertive">
            {result && (
              <div className={`flex items-start gap-3 rounded-card border p-4 ${style}`} role="status">
                <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-display text-lg font-semibold">{result.title}</p>
                  <p className="text-sm">{result.text}</p>
                </div>
              </div>
            )}
          </div>

          <form
            className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              last.current = { code: '', at: 0 };
              submit(manual).then(() => setManual(''));
            }}
          >
            <div className="flex-1">
              <label htmlFor="manual-code" className="label flex items-center gap-2">
                <Keyboard className="h-4 w-4" aria-hidden="true" /> Enter ticket code
              </label>
              <input
                id="manual-code"
                className="input font-mono"
                autoComplete="off"
                placeholder="e.g. 3fK9xQ2mPa7L"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy || !manual.trim() || !eventId}>
              {busy && <Spinner className="h-4 w-4" />} Check in
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
