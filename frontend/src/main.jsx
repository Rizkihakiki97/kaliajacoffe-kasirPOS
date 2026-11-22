import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

// StrictMode sengaja tidak dipakai: double-mount saat development memicu
// AbortController pada effect, sehingga request API terlihat ERR_ABORTED
// (merah) di Network tab. Produksi tidak pernah melakukan double-invoke ini.
createRoot(document.getElementById('root')).render(<App />);
