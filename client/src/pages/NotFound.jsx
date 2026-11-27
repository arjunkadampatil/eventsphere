import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="font-display text-6xl font-extrabold text-primary-600">404</p>
      <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">That page doesn&apos;t exist or has moved.</p>
      <div className="mt-8 flex gap-3">
        <Link to="/" className="btn btn-secondary">
          Home
        </Link>
        <Link to="/events" className="btn btn-primary">
          Browse events
        </Link>
      </div>
    </div>
  );
}
