import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getSocket } from './socket';

// App-wide: pop a toast whenever a club posts to an event this user follows or is registered for.
export function useAnnouncementToasts() {
  const { status } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (status === 'loading') return undefined;
    const socket = getSocket();
    const onAnnouncement = (a) => {
      toast.announcement(a.message, a.event.title);
      queryClient.invalidateQueries({ queryKey: ['announcements', a.event.id] });
      queryClient.invalidateQueries({ queryKey: ['me', 'announcements'] });
    };
    socket.on('announcement', onAnnouncement);
    return () => socket.off('announcement', onAnnouncement);
  }, [status, toast, queryClient]);
}

// Event page: follow the event's room while the page is open (works signed out too).
export function useFollowEvent(eventId) {
  const { status } = useAuth();
  useEffect(() => {
    if (!eventId || status === 'loading') return undefined;
    const socket = getSocket();
    const follow = () => socket.emit('event:follow', eventId);
    follow();
    socket.on('connect', follow);
    return () => {
      socket.off('connect', follow);
      socket.emit('event:unfollow', eventId);
    };
  }, [eventId, status]);
}
