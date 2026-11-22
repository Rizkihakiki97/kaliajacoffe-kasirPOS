import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import api from '../api/client';
import { EmptyState, ImageThumb, PageHeader, Spinner } from '../components/ui';
import { formatDate } from '../utils/format';

export default function ActivitiesPage() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    api.activities
      .list(controller.signal)
      .then((data) => setActivities(data || []))
      .catch(() => setActivities([]))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  return (
    <div className="container page-pad">
      <PageHeader
        title="Galeri Kegiatan"
        description="Dokumentasi momen, acara, dan cerita dari Kaliaja.coffe."
      />
      {loading ? (
        <Spinner label="Memuat galeri..." />
      ) : activities.length ? (
        <div className="grid grid--3">
          {activities.map((activity) => (
            <article key={activity.id} className="activity-card">
              <ImageThumb src={activity.image_url} alt={activity.title} className="activity-card__image" />
              <div className="activity-card__body">
                <span><CalendarDays size={15} /> {formatDate(activity.event_date)}</span>
                <h3>{activity.title}</h3>
                {activity.description && <p>{activity.description}</p>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Belum ada kegiatan" description="Foto kegiatan akan tampil di sini setelah diunggah Admin." />
      )}
    </div>
  );
}
