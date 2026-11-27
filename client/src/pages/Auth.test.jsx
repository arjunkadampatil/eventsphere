import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { Login, Signup } from './Auth';
import { jsonResponse, renderWithProviders } from '../test/render';
import { setSession } from '../lib/api';

function mockFetch(handlers) {
  return vi.fn((url, init = {}) => {
    const key = `${init.method ?? 'GET'} ${url}`;
    const handler = handlers[key];
    if (!handler) return jsonResponse({ error: { message: 'Not found' } }, 404);
    return handler(JSON.parse(init.body ?? 'null'));
  });
}

const session = (role) => ({
  accessToken: 'token',
  user: { id: 'u1', name: 'Demo User', email: `${role}@eventsphere.dev`, role },
});

beforeEach(() => setSession(null));
afterEach(() => vi.unstubAllGlobals());

describe('Login', () => {
  it('signs in with a one-click demo account and lands on that role home', async () => {
    const fetch = mockFetch({
      'POST /api/auth/refresh': () => jsonResponse({ error: { message: 'Missing refresh token.' } }, 401),
      'GET /api/auth/providers': () => jsonResponse({ google: false }),
      'POST /api/auth/login': (body) => jsonResponse(session(body.email.split('@')[0])),
    });
    vi.stubGlobal('fetch', fetch);

    renderWithProviders(
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/club" element={<p>Club home</p>} />
      </Routes>,
      { route: '/login' },
    );

    await userEvent.click(await screen.findByRole('button', { name: /Club club@eventsphere\.dev/ }));
    expect(await screen.findByText('Club home')).toBeInTheDocument();
    const loginCall = fetch.mock.calls.find(([url]) => url === '/api/auth/login');
    expect(JSON.parse(loginCall[1].body)).toEqual({ email: 'club@eventsphere.dev', password: 'Demo@1234' });
    expect(loginCall[1].credentials).toBe('include');
  });

  it('shows the server error for bad credentials', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        'POST /api/auth/refresh': () => jsonResponse({ error: { message: 'x' } }, 401),
        'GET /api/auth/providers': () => jsonResponse({ google: true }),
        'POST /api/auth/login': () => jsonResponse({ error: { message: 'Incorrect email or password.' } }, 401),
      }),
    );
    renderWithProviders(<Login />, { route: '/login' });

    expect(await screen.findByRole('link', { name: /Continue with Google/ })).toHaveAttribute('href', '/api/auth/google');
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.dev');
    await userEvent.type(screen.getByLabelText('Password'), 'wrongpass1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
  });
});

describe('Signup', () => {
  it('maps API validation errors onto the right fields', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        'POST /api/auth/refresh': () => jsonResponse({ error: { message: 'x' } }, 401),
        'GET /api/auth/providers': () => jsonResponse({ google: false }),
        'POST /api/auth/register': () =>
          jsonResponse(
            {
              error: {
                message: 'Validation failed.',
                details: [{ path: 'password', message: 'Password must contain a number.' }],
              },
            },
            400,
          ),
      }),
    );
    renderWithProviders(<Signup />, { route: '/signup' });

    await waitFor(() => expect(screen.getByLabelText('Full name')).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText('Full name'), 'Nisha Patel');
    await userEvent.type(screen.getByLabelText('Email'), 'nisha@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'onlyletters');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Password must contain a number.')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
  });
});
