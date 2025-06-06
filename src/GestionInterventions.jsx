// src/GestionInterventions.jsx

import { supabase } from './lib/supabaseClient';
// Import the new modal component
import InterventionModal from './InterventionModal';

const GestionInterventions = ({
  selectedIntervention,
  setSelectedIntervention,
  isCreating,
  setIsCreating,
  // refresh, // This prop becomes unused if the local list is removed
  onRefreshCalendar,
  lots, // Sera passé à InterventionForm en tant que allLots
  onCloseForm, // Nouvelle prop pour gérer la fermeture depuis App.jsx
  initialLotId // Assurez-vous que cette prop est bien passée depuis App.jsx
}) => {
  // The local 'interventions' state and its fetching logic are removed
  // as App.jsx now handles the display context for this form.

  // Callback appelé par InterventionModal après une action réussie (save ou delete)
  const handleModalSuccess = () => {
      // Déclenche le rafraîchissement dans le composant parent (App.jsx)
      onRefreshCalendar?.(); // Appelle le callback de App.jsx pour rafraîchir
  };
  return ( // The wrapping div and the h2/ul for a local list are removed.
    /* Utiliser le nouveau composant InterventionModal */
      <InterventionModal
          onClose={onCloseForm} // Le bouton "Annuler" de InterventionForm appellera directement onCloseForm de App.jsx
          interventionData={selectedIntervention} // Passe les données de l'intervention sélectionnée
          isCreating={isCreating}
          allLots={lots} // <-- Change prop name from 'lots' to 'allLots'
          currentLotId={initialLotId} // <-- Change prop name from 'initialLotId' to 'currentLotId'
          onSaveSuccess={handleModalSuccess} // Passe le callback de succès
          onDeleteSuccess={handleModalSuccess} // Passe le callback de succès
 />
  );
};

export default GestionInterventions;
