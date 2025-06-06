// Fichier : src/pages/CreateIntervention.jsx
import { useState } from 'react';
import GestionInterventions from '../components/GestionInterventions';

export default function CreateIntervention() {
  const [selectedIntervention, setSelectedIntervention] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [refresh, setRefresh] = useState(false);

  const projets = [
    {
      id: 1,
      nom: 'Projet A',
      lots: [{ id: 101, nom: 'Lot 1' }, { id: 102, nom: 'Lot 2' }]
    },
    {
      id: 2,
      nom: 'Projet B',
      lots: [{ id: 201, nom: 'Lot B1' }]
    }
  ];

  return (
    <GestionInterventions
      selectedIntervention={selectedIntervention}
      setSelectedIntervention={setSelectedIntervention}
      isCreating={isCreating}
      setIsCreating={setIsCreating}
      refresh={refresh}
      onRefresh={() => setRefresh((prev) => !prev)}
      projets={projets}
    />
  );
}
