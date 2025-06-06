import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import moment from 'moment';
import 'moment/locale/fr'; // Importer la locale française
import './index.css'
import App from './App.jsx'

// Définir la locale globalement pour moment
moment.locale('fr');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
