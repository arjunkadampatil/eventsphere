import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EventCard from './EventCard';

const base = {
  id: 'e1',
  title: 'HackSphere',
  category: 'Hackathon',
  club: { name: 'Coding Club' },
  startsAt: '2026-12-10T04:30:00Z',
  endsAt: '2026-12-11T04:30:00Z',
  mode: 'offline',
  venue: 'Innovation Hub',
  fee: 0,
  capacity: 120,
  registrationsCount: 40,
  isFull: false,
  posterUrl: '',
};

const renderCard = (event) =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <EventCard event={event} />
    </MemoryRouter>,
  );

describe('EventCard', () => {
  it('shows the essentials and links to the event', () => {
    renderCard(base);
    expect(screen.getByRole('link', { name: 'HackSphere' })).toHaveAttribute('href', '/events/e1');
    expect(screen.getByText('Coding Club')).toBeInTheDocument();
    expect(screen.getByText('Innovation Hub')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('40 going')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Hackathon event: HackSphere/ })).toBeInTheDocument();
  });

  it('warns when seats are running out and when full', () => {
    const { unmount } = renderCard({ ...base, registrationsCount: 110 });
    expect(screen.getByText('10 seats left')).toBeInTheDocument();
    unmount();
    renderCard({ ...base, registrationsCount: 120, isFull: true, fee: 250 });
    expect(screen.getByText('Full')).toBeInTheDocument();
    expect(screen.getByText('₹250')).toBeInTheDocument();
  });

  it('uses the uploaded poster with alt text when present', () => {
    renderCard({ ...base, posterUrl: 'https://res.cloudinary.com/demo/poster.jpg', mode: 'online' });
    expect(screen.getByAltText('Poster for HackSphere')).toHaveAttribute('src', 'https://res.cloudinary.com/demo/poster.jpg');
    expect(screen.getByText('Online')).toBeInTheDocument();
  });
});
