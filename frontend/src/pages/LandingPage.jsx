import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Coffee, Heart, Leaf, MapPin, Sparkles } from 'lucide-react';
import api from '../api/client';
import { ImageThumb, Spinner } from '../components/ui';
import { rupiah } from '../utils/format';

const highlights = [
  { icon: Coffee, title: 'Menu Pilihan', text: 'Coffee, non-coffee, dan snack dengan racikan terbaik.' },
  { icon: Leaf, title: 'Bahan Segar', text: 'Disiapkan setiap hari supaya rasa tetap konsisten.' },
  { icon: Heart, title: 'Suasana Nyaman', text: 'Tempat ngopi dan berkumpul bersama orang tersayang.' },
];

export default function LandingPage() {
  const [products, setProducts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([api.products.list(undefined, controller.signal), api.activities.list(controller.signal)])
      .then(([productData, activityData]) => {
        setProducts((productData || []).slice(0, 6));
        setActivities((activityData || []).slice(0, 3));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  return (
    <>
      <section className="hero">
        <div className="hero__glow hero__glow--one" />
        <div className="hero__glow hero__glow--two" />
        <div className="container hero__inner">
          <div className="hero__copy">
            <span className="eyebrow"><Sparkles size={15} /> Selamat datang di Kaliaja.coffe</span>
            <h1>Ngopi enak,<br /><em>pesannya gampang.</em></h1>
            <p>
              Jelajahi menu favorit kami, pesan langsung dari mana saja, dan nikmati pengalaman kafe
              yang lebih sederhana — dari pelanggan sampai kasir.
            </p>
            <div className="hero__actions">
              <Link to="/menu" className="btn btn--primary btn--lg">Lihat Menu <ArrowRight size={18} /></Link>
              <Link to="/activities" className="btn btn--outline btn--lg">Kegiatan Kami</Link>
            </div>
            <div className="hero__note"><MapPin size={16} /> Melayani pesanan langsung di kafe</div>
          </div>
          <div className="hero__art" aria-hidden="true">
            <div className="hero__cup">
              <div className="hero__steam"><i /><i /><i /></div>
              <div className="hero__cup-body"><span>kaliaja</span></div>
              <div className="hero__saucer" />
            </div>
            <div className="hero__badge"><Coffee size={18} /> Freshly brewed, every day</div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section__heading">
            <span className="eyebrow eyebrow--dark">Kenapa Kaliaja?</span>
            <h2>Secangkir kopi, banyak cerita</h2>
          </div>
          <div className="grid grid--3">
            {highlights.map(({ icon: Icon, title, text }) => (
              <div key={title} className="feature-card">
                <div className="feature-card__icon"><Icon size={23} /></div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--tint">
        <div className="container">
          <div className="section__heading section__heading--row">
            <div>
              <span className="eyebrow eyebrow--dark">Dari menu kami</span>
              <h2>Paling disukai</h2>
            </div>
            <Link to="/menu" className="text-link">Lihat semua menu <ArrowRight size={16} /></Link>
          </div>
          {loading ? (
            <Spinner label="Memuat menu..." />
          ) : products.length ? (
            <div className="grid grid--3">
              {products.map((product) => (
                <article key={product.id} className="mini-product">
                  <ImageThumb src={product.image_url} alt={product.name} className="mini-product__image" />
                  <div className="mini-product__body">
                    <span className="mini-product__category">{product.category_name}</span>
                    <h3>{product.name}</h3>
                    <p>{product.description || 'Racikan pilihan Kaliaja.coffe.'}</p>
                    <strong>{rupiah(product.price)}</strong>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="notice">Menu belum tersedia. Tambahkan produk melalui dashboard Admin.</div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section__heading section__heading--row">
            <div>
              <span className="eyebrow eyebrow--dark">Galeri kami</span>
              <h2>Momen di Kaliaja.coffe</h2>
            </div>
            <Link to="/activities" className="text-link">Semua kegiatan <ArrowRight size={16} /></Link>
          </div>
          {loading ? (
            <Spinner label="Memuat galeri..." />
          ) : activities.length ? (
            <div className="grid grid--3">
              {activities.map((activity) => (
                <article key={activity.id} className="activity-card">
                  <ImageThumb src={activity.image_url} alt={activity.title} className="activity-card__image" />
                  <div className="activity-card__body">
                    <span><CalendarDays size={15} /> {new Date(activity.event_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                    <h3>{activity.title}</h3>
                    {activity.description && <p>{activity.description}</p>}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="notice">Belum ada foto kegiatan yang dipublikasikan.</div>
          )}
        </div>
      </section>

      <section className="cta-section">
        <div className="container cta-section__inner">
          <div>
            <span className="eyebrow">Siap pesan?</span>
            <h2>Pilih menu favoritmu sekarang</h2>
            <p>Pesan lebih cepat, antre lebih singkat, kopi tetap hangat.</p>
          </div>
          <Link to="/menu" className="btn btn--light btn--lg">Mulai Pesan <ArrowRight size={18} /></Link>
        </div>
      </section>
    </>
  );
}
