import { useState } from 'react';
import { supabase } from './lib/supabaseClient';
import Modal from './Modal';
const ListeLots = ({ lotId, interventions, onSelectIntervention, projets, onRefresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null); // 'projet' ou 'lot'
  const [currentItem, setCurrentItem] = useState(null);

  const [newNom, setNewNom] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDateDebut, setNewDateDebut] = useState('');
  const [newDateFin, setNewDateFin] = useState('');

  const openModal = (type, item) => {
    setModalType(type);
    setCurrentItem(item);
    setNewNom(item.nom);
    setNewDescription(item.description || '');
    setNewDateDebut(item.date_debut || '');
    setNewDateFin(item.date_fin || '');
    setIsModalOpen(true);
  };

  const handleUpdate = async () => {
    const table = modalType === 'projet' ? 'projets' : 'lots';
    const updateFields =
      modalType === 'projet'
        ? {
            nom: newNom,
            description: newDescription,
            date_debut: newDateDebut || null,
            date_fin: newDateFin || null,
          }
        : { nom: newNom };

    const { error } = await supabase
      .from(table)
      .update(updateFields)
      .eq('id', currentItem.id);

    if (!error) {
      setIsModalOpen(false);
      onRefresh();
    } else {
      alert('Erreur : ' + error.message);
    }
  };

  const handleDelete = async () => {
    const confirmation = confirm(`Supprimer ce ${modalType} ?`);
    if (!confirmation) return;

    const table = modalType === 'projet' ? 'projets' : 'lots';
    const { error } = await supabase.from(table).delete().eq('id', currentItem.id);

    if (!error) {
      setIsModalOpen(false);
      onRefresh();
    } else {
      alert('Erreur : ' + error.message);
    }
  };

  // Si la prop 'interventions' est fournie (comme c'est le cas depuis App.jsx pour la barre latérale),
  // afficher la liste des interventions pour le lot concerné.
  if (interventions && typeof onSelectIntervention === 'function') {
    if (!interventions.length) {
      return <p style={{ fontSize: '0.8em', fontStyle: 'italic', margin: '5px 0 0 0', paddingLeft: '10px' }}>Aucune intervention.</p>;
    }
    return (
      <ul style={{ listStyleType: 'disc', paddingLeft: '20px', margin: '5px 0 0 0', fontSize: '0.8em' }}>
        {/* S'assurer que 'interventions' est bien un tableau avant de mapper */}
        {(Array.isArray(interventions) ? interventions : []).map(interv => (
          <li key={interv.id} onClick={() => onSelectIntervention(interv)} style={{cursor: 'pointer', marginBottom: '3px', color: '#337ab7'}}>
            {interv.nom} ({interv.date})
          </li>
        ))}
      </ul>
    );
  }

  // Comportement original : si la prop 'projets' est fournie, lister les projets et leurs lots.
  const safeProjets = projets || []; // Assurer que projets est un tableau pour éviter .map sur undefined
  return (
    <div>
      <h2>Liste des lots par projet</h2>
      {safeProjets.map((projet) => (
        <div key={projet.id}>
          <h3
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => openModal('projet', projet)}
          >
            {projet.nom}
          </h3>
          <ul>
            {(projet.lots || []).map((lot) => (
              <li
                key={lot.id}
                onClick={() => openModal('lot', lot)}
                style={{ cursor: 'pointer' }}
              >
                {lot.nom}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <h3>Modifier {modalType}</h3>
        <div>
          <label>Nom :</label><br />
          <input value={newNom} onChange={(e) => setNewNom(e.target.value)} /><br />

          {modalType === 'projet' && (
            <>
              <label>Description :</label><br />
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              /><br />

              <label>Date de début :</label><br />
              <input
                type="date"
                value={newDateDebut?.split('T')[0]}
                onChange={(e) => setNewDateDebut(e.target.value)}
              /><br />

              <label>Date de fin :</label><br />
              <input
                type="date"
                value={newDateFin?.split('T')[0]}
                onChange={(e) => setNewDateFin(e.target.value)}
              /><br />
            </>
          )}
        </div>
        <br />
        <button onClick={handleUpdate}>💾 Enregistrer</button>{' '}
        <button onClick={handleDelete} style={{ color: 'red' }}>🗑 Supprimer</button>
      </Modal>
    </div>
  );
};

export default ListeLots;
