import { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { findAvailableShade } from './utils/colorUtils'; // Importer la nouvelle fonction

const EditLot = ({ lot, onSave, onDelete, onClose, parentProjet, siblingLots, onOpenGestionEntreprisesModal }) => {
  const [nomLot, setNomLot] = useState(''); // Changed from 'nom' to 'nomLot' for clarity
  const [toutesLesEntreprises, setToutesLesEntreprises] = useState([]); // Toutes les entreprises disponibles
  const [selectedEntrepriseIds, setSelectedEntrepriseIds] = useState(new Set()); // IDs des entreprises associées à ce lot
  const [loadingEntreprises, setLoadingEntreprises] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [couleurLot, setCouleurLot] = useState('#cccccc');
  const [isLoading, setIsLoading] = useState(false); // Added isLoading state
  // Les états suivants pour la création d'entreprise inline sont supprimés
  // const [showCreateEntrepriseForm, setShowCreateEntrepriseForm] = useState(false);
  // const [newEntrepriseName, setNewEntrepriseName] = useState('');
  // const [isCreatingEntreprise, setIsCreatingEntreprise] = useState(false);

  useEffect(() => {
    if (lot) {
      setNomLot(lot.nom || '');
      // Initialiser les entreprises sélectionnées pour ce lot
      const initialSelectedIds = new Set(
        (lot.entreprises_associees || []).map(e => e.id)
      );
      setSelectedEntrepriseIds(initialSelectedIds);
      if (lot.color) {
        setCouleurLot(lot.color);
      } else if (parentProjet && parentProjet.color && siblingLots) {
        const usedColors = siblingLots.map(l => l.color).filter(Boolean);
        console.log(`[EditLot useEffect] Appel de findAvailableShade pour projet ${parentProjet.nom} (couleur: ${parentProjet.color}). Couleurs de lots frères utilisées:`, JSON.stringify(usedColors));
        
        const suggestedColor = findAvailableShade(parentProjet.color, usedColors, '#cccccc');
        setCouleurLot(suggestedColor);
      console.log(`[EditLot useEffect] Couleur suggérée pour le lot (si pas de couleur existante): ${suggestedColor}`);
      
      } else {
        setCouleurLot('#cccccc');
      }
      setIsDeleting(false); // Reset delete confirmation
    }
    const fetchEntreprises = async () => {
      setLoadingEntreprises(true);
      const { data, error } = await supabase.from('entreprises').select('id, nom, contact_nom'); // Récupérer aussi contact_nom
      if (error) {
        console.error("Error fetching toutesLesEntreprises for EditLot:", error);
        setToutesLesEntreprises([]);
      } else {
        setToutesLesEntreprises(data || []);
      }
      setLoadingEntreprises(false);
    };
    fetchEntreprises();
  }, [lot, parentProjet, siblingLots]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!nomLot.trim()) { // Use nomLot
      alert('Le nom du lot ne peut pas être vide.');
      return;
    }
    if (!lot || !lot.id) {
      alert('Erreur : ID du lot manquant.');
      return;
    }
    setIsLoading(true);

    const payload = {
      nom: nomLot.trim(), // Use nomLot
      color: couleurLot // Include color in the payload
    };
    console.log("Updating Lot with payload:", payload, "for ID:", lot.id);

    const { error: lotUpdateError } = await supabase
      .from('lots')
      .update(payload)
      .eq('id', lot.id);

    if (lotUpdateError) {
      alert(`Erreur lors de la mise à jour du lot : ${lotUpdateError.message}`);
      setIsLoading(false);
      return;
    }

    // Gérer les associations dans lots_entreprises
    // 1. Supprimer les anciennes associations pour ce lot
    const { error: deleteError } = await supabase
      .from('lots_entreprises')
      .delete()
      .eq('lot_id', lot.id);

    if (deleteError) {
      console.error("Erreur lors de la suppression des anciennes associations d'entreprises:", deleteError);
      // Gérer l'erreur, peut-être annuler ou informer l'utilisateur
    }

    // 2. Insérer les nouvelles associations
    const newAssociations = Array.from(selectedEntrepriseIds).map(entrepriseId => ({
      lot_id: lot.id,
      entreprise_id: entrepriseId,
    }));

    if (newAssociations.length > 0) {
      const { error: insertError } = await supabase.from('lots_entreprises').insert(newAssociations);
      if (insertError) {
        alert(`Erreur lors de la sauvegarde des associations d'entreprises : ${insertError.message}`);
        // Gérer l'erreur
      }
    }
    alert('Lot et associations mis à jour avec succès !');
    onSave();
    setIsLoading(false);
  };

  const handleDelete = async () => {
    if (!lot || !lot.id) {
      alert('Erreur : ID du lot manquant.');
      return;
    }
    // La suppression en cascade dans la BDD devrait gérer lots_entreprises
    const { error } = await supabase.from('lots').delete().eq('id', lot.id);

    if (error) {
      alert(`Erreur lors de la suppression du lot : ${error.message}`);
    } else {
      alert('Lot supprimé avec succès !');
      onDelete();
    }
  };

  if (!lot) return null;

  const handleOpenCreateEntrepriseModal = () => {
    // Appeler la fonction passée par App.jsx pour ouvrir la modale globale
    // Il est possible que vous souhaitiez fermer la modale EditLot avant ou après,
    // ou la laisser ouverte. Pour l'instant, on appelle juste la fonction.
    // Si la modale EditLot doit se fermer, onClose() pourrait être appelé ici.
    onOpenGestionEntreprisesModal?.();
  };

  const handleEntrepriseSelectionChange = (entrepriseId) => {
    setSelectedEntrepriseIds(prevSelectedIds => {
      const newSelectedIds = new Set(prevSelectedIds);
      if (newSelectedIds.has(entrepriseId)) {
        newSelectedIds.delete(entrepriseId);
      } else {
        newSelectedIds.add(entrepriseId);
      }
      return newSelectedIds;
    });
  };

  return (
    <div style={{ padding: '1rem' }}> {/* Added padding for modal consistency */}
      {/* Title is now handled by App.jsx when rendering the modal */}
      <form onSubmit={handleSave}>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="lot-nom-edit">Nom du lot :</label>
          <input
            type="text"
            id="lot-nom-edit"
            value={nomLot} // Use nomLot
            onChange={(e) => setNomLot(e.target.value)} // Use setNomLot
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="edit-couleurLot" style={{ display: 'block', marginBottom: '5px' }}>Couleur du lot :</label>
          <input type="color" id="edit-couleurLot" value={couleurLot} onChange={(e) => setCouleurLot(e.target.value)} style={{ width: '100%', padding: '3px', boxSizing: 'border-box', height: '40px' }} />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label>Entreprises associées :</label>
          {loadingEntreprises ? <p>Chargement des entreprises...</p> : (
            <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #ccc', padding: '5px' }}>
              {toutesLesEntreprises.length === 0 ? <p>Aucune entreprise disponible.</p> :
                toutesLesEntreprises.map((entreprise) => (
                <div key={entreprise.id}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedEntrepriseIds.has(entreprise.id)}
                      onChange={() => handleEntrepriseSelectionChange(entreprise.id)}
                      style={{ marginRight: '8px' }}
                    />
                    {entreprise.nom} {entreprise.contact_nom ? `- ${entreprise.contact_nom}` : ''}
                  </label>
                </div>
              ))}
            </div>
          )}
          {!loadingEntreprises && (
            <div style={{marginTop: '10px'}}>
              <button 
                type="button" 
                onClick={handleOpenCreateEntrepriseModal} 
              >
                Créer/Gérer une entreprise
              </button>
            </div>
          )}
          {(lot.entreprises_associees || []).length > 0 && !loadingEntreprises && (
            <div style={{fontSize: '0.8em', marginTop: '5px'}}>
              Actuellement associées : {lot.entreprises_associees.map(e => e.nom).join(', ')}
            </div>
          )}
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="submit" disabled={isLoading} style={{ padding: '8px 15px' }}>
            {isLoading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          {!isDeleting ? (
            <button type="button" onClick={() => setIsDeleting(true)} disabled={isLoading} style={{ padding: '8px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}>Supprimer</button>
          ) : (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span>Confirmer ?</span>
              <button type="button" onClick={handleDelete} style={{ padding: '8px 15px', backgroundColor: '#c82333', color: 'white', border: 'none', borderRadius: '4px' }}>Oui, supprimer</button>
              <button type="button" onClick={() => setIsDeleting(false)} style={{ padding: '8px 15px' }}>Annuler</button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
export default EditLot;