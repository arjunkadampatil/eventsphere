import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Trash2 } from 'lucide-react';
import { api, ApiError, assetUrl } from '../../lib/api';
import { toLocalInput } from '../../lib/format';
import { useToast } from '../../context/ToastContext';
import { CATEGORY_STYLE } from '../../lib/categories';
import { BackLink, Field, PageHeader, PageLoader, Spinner } from '../../components/ui';

const EMPTY = {
  title: '',
  description: '',
  category: 'Tech',
  startsAt: '',
  endsAt: '',
  mode: 'offline',
  venue: '',
  meetingLink: '',
  capacity: '0',
  fee: '0',
  tags: '',
};

export default function EventForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [poster, setPoster] = useState(null);
  const [preview, setPreview] = useState('');
  const [errors, setErrors] = useState({});

  const existing = useQuery({
    queryKey: ['event', id],
    queryFn: () => api.get(`/api/events/${id}`),
    enabled: editing,
  });

  useEffect(() => {
    const e = existing.data?.event;
    if (!e) return;
    setForm({
      title: e.title,
      description: e.description,
      category: e.category,
      startsAt: toLocalInput(e.startsAt),
      endsAt: toLocalInput(e.endsAt),
      mode: e.mode,
      venue: e.mode === 'online' ? '' : e.venue,
      meetingLink: e.meetingLink ?? '',
      capacity: String(e.capacity),
      fee: String(e.fee),
      tags: e.tags.join(', '),
    });
    setPreview(assetUrl(e.posterUrl));
  }, [existing.data]);

  useEffect(() => () => preview.startsWith('blob:') && URL.revokeObjectURL(preview), [preview]);

  const save = useMutation({
    mutationFn: () => {
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'startsAt' || k === 'endsAt') data.append(k, v ? new Date(v).toISOString() : '');
        else data.append(k, v);
      });
      if (poster) data.append('poster', poster);
      return editing ? api.upload(`/api/events/${id}`, data, 'PATCH') : api.upload('/api/events', data);
    },
    onSuccess: ({ event }) => {
      queryClient.invalidateQueries({ queryKey: ['manage-events'] });
      queryClient.invalidateQueries({ queryKey: ['event', event.id] });
      toast.success(editing ? 'Event updated.' : 'Event submitted. An admin will review it shortly.');
      navigate(`/club/events/${event.id}`);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.details) {
        setErrors(err.fieldErrors());
        toast.error('Please fix the highlighted fields.');
      } else {
        toast.error(err.message);
      }
    },
  });

  if (editing && existing.isLoading) return <PageLoader />;

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const input = (key, props = {}) =>
    function renderInput({ id: inputId, invalid }) {
      return <input id={inputId} className="input" aria-invalid={invalid} value={form[key]} onChange={set(key)} {...props} />;
    };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <BackLink to={editing ? `/club/events/${id}` : '/club'}>Back</BackLink>
      <PageHeader
        title={editing ? 'Edit event' : 'Create an event'}
        subtitle={editing ? 'Changes go live immediately for approved events.' : 'New events are reviewed by an admin before they appear publicly.'}
      />
      <form
        className="card space-y-6 p-5 sm:p-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setErrors({});
          save.mutate();
        }}
      >
        <div>
          <span className="label">Poster</span>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-card border-2 border-dashed border-slate-300 bg-slate-50 sm:w-64 dark:border-slate-700 dark:bg-slate-800/50">
              {preview ? (
                <img src={preview} alt="Poster preview" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="h-8 w-8 text-slate-400" aria-hidden="true" />
              )}
            </div>
            <div className="space-y-2 text-sm">
              <label className="btn btn-secondary cursor-pointer">
                <ImagePlus className="h-4 w-4" aria-hidden="true" /> {preview ? 'Replace poster' : 'Upload poster'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error('Poster must be 5 MB or smaller.');
                      return;
                    }
                    setPoster(file);
                    setPreview(URL.createObjectURL(file));
                  }}
                />
              </label>
              {poster && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setPoster(null);
                    setPreview(assetUrl(existing.data?.event.posterUrl ?? ''));
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove
                </button>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">JPG, PNG or WebP, up to 5 MB. Stored on Cloudinary. Optional: events without a poster get a category design.</p>
            </div>
          </div>
        </div>

        <Field label="Title" error={errors.title}>
          {input('title', { maxLength: 120 })}
        </Field>
        <Field label="Description" error={errors.description} hint="What will people do, learn or win? At least 20 characters.">
          {({ id: fid, invalid }) => (
            <textarea id={fid} rows={6} className="input" aria-invalid={invalid} value={form.description} onChange={set('description')} />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Category" error={errors.category}>
            {({ id: fid }) => (
              <select id={fid} className="input" value={form.category} onChange={set('category')}>
                {Object.keys(CATEGORY_STYLE).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Tags" error={errors.tags} hint="Comma-separated, e.g. ai, beginners">
            {input('tags')}
          </Field>
          <Field label="Starts" error={errors.startsAt}>
            {input('startsAt', { type: 'datetime-local' })}
          </Field>
          <Field label="Ends" error={errors.endsAt}>
            {input('endsAt', { type: 'datetime-local' })}
          </Field>
        </div>

        <fieldset>
          <legend className="label">Format</legend>
          <div className="inline-flex rounded-card border border-slate-200 p-0.5 dark:border-slate-700">
            {['offline', 'online'].map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={form.mode === m}
                onClick={() => setForm({ ...form, mode: m })}
                className="rounded-[10px] px-4 py-1.5 text-sm font-medium text-slate-600 capitalize aria-pressed:bg-primary-600 aria-pressed:text-white dark:text-slate-300"
              >
                {m === 'offline' ? 'In person' : 'Online'}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-3">
          {form.mode === 'offline' ? (
            <Field label="Venue" error={errors.venue} className="sm:col-span-3">
              {input('venue', { placeholder: 'e.g. Seminar Hall A' })}
            </Field>
          ) : (
            <Field label="Meeting link" error={errors.meetingLink} hint="Only shown to registered students." className="sm:col-span-3">
              {input('meetingLink', { type: 'url', placeholder: 'https://meet.google.com/…' })}
            </Field>
          )}
          <Field label="Capacity" error={errors.capacity} hint="0 = unlimited">
            {input('capacity', { type: 'number', min: 0, inputMode: 'numeric' })}
          </Field>
          <Field label="Fee (₹)" error={errors.fee} hint="0 = free">
            {input('fee', { type: 'number', min: 0, inputMode: 'decimal' })}
          </Field>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end dark:border-slate-800">
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending && <Spinner className="h-4 w-4" />} {editing ? 'Save changes' : 'Submit for approval'}
          </button>
        </div>
      </form>
    </div>
  );
}
