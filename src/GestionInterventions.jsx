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
  // lots, // Cette prop n'est plus nécessaire si allLots est toujours fourni par App.jsx
  onCloseForm, // Nouvelle prop pour gérer la fermeture depuis App.jsx
  initialLotId, // Assurez-vous que cette prop est bien passée depuis App.jsx
  allInterventions, // Nouvelle prop pour toutes les interventions
  allLots, // Renommer 'lots' en 'allLots' pour la clarté et passer toutes les instances
  allProjets, // Nouvelle prop pour tous les projets (potentiellement filtrés pour l'affichage du select)
  // Les props suivantes sont pour la détection de conflit et doivent être les listes complètes
  entreprisesList // Nouvelle prop pour la liste des entreprises
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
          allLots={allLots} // allLots est maintenant directement fourni par App.jsx
          currentLotId={initialLotId} // <-- Change prop name from 'initialLotId' to 'currentLotId'
          onSaveSuccess={handleModalSuccess} // Passe le callback de succès
          onDeleteSuccess={handleModalSuccess} // Passe le callback de succès
          allInterventions={allInterventions} // Liste globale des interventions
          allProjets={allProjets} // Liste globale des projets pour la détection de conflit
          entreprisesList={entreprisesList} // Passer la liste des entreprises
 />
  );
};

export default GestionInterventions;
