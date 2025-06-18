import { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { findAvailableShade } from './utils/colorUtils'; // Importer la nouvelle fonction

const EditLot = ({ lot, onSave, onDelete, onClose, parentProjet, siblingLots, onOpenGestionEntreprisesModal }) => {
  const [nomLot, setNomLot] = useState(''); // Changed from 'nom' to 'nomLot' for clarity
  const [toutesLesEntreprises, setToutesLesEntreprises] = useState([]); // Toutes les entreprises disponibles
  const [selectedEntrepriseId, setSelectedEntrepriseId] = useState(''); // ID de l'entreprise principale associée
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
      console.log('[EditLot useEffect] Received lot prop:', JSON.parse(JSON.stringify(lot)));
      setNomLot(lot.nom || '');
      // Initialiser l'entreprise principale sélectionnée pour ce lot
      setSelectedEntrepriseId(lot.entreprise_id || ''); // Utilise directement lot.entreprise_id
      console.log('[EditLot useEffect] Initial selectedEntrepriseId set to:', lot.entreprise_id || '');
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
        // Trier les entreprises par nom avant de les stocker dans l'état
        const sortedEntreprises = (data || []).sort((a, b) => 
          a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' })
        );
        setToutesLesEntreprises(sortedEntreprises);
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

    const lotPayload = {
      nom: nomLot.trim(), // Use nomLot
      color: couleurLot, // Include color in the payload
      entreprise_id: selectedEntrepriseId || null // Mettre à jour entreprise_id directement sur le lot
    };
    console.log("[EditLot handleSave] Updating Lot with payload:", lotPayload, "for ID:", lot.id);
    // let allOperationsSuccessful = true; // Moins pertinent si on ne gère plus lots_entreprises ici

    const { error: lotUpdateError } = await supabase
      .from('lots')
      .update(lotPayload)
      .eq('id', lot.id);
    if (lotUpdateError) {
      console.error("[EditLot handleSave] Error updating lot:", lotUpdateError);
      alert(`Erreur lors de la mise à jour du lot : ${lotUpdateError.message}`);
      setIsLoading(false);
      return; // Arrêter si la mise à jour du lot échoue
    }
    console.log("[EditLot handleSave] Lot updated successfully.");

    // La logique pour lots_entreprises est retirée pour se concentrer sur lots.entreprise_id
    // Si vous avez besoin des deux, il faudra une logique plus complexe.

    alert('Lot mis à jour avec succès !');
    onSave();
    setIsLoading(false);
  };

  const handleDelete = async () => {
    if (!lot || !lot.id) {
      alert('Erreur : ID du lot manquant.');
      return;
    }
    // Si vous utilisez toujours lots_entreprises et que la suppression en cascade n'est pas configurée,
    // vous devriez supprimer les entrées de lots_entreprises ici avant de supprimer le lot.
    // Exemple :
    // await supabase.from('lots_entreprises').delete().eq('lot_id', lot.id);

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
          <label htmlFor="edit-lot-entreprise-principale">Entreprise principale :</label>
          {loadingEntreprises ? <p>Chargement des entreprises...</p> : (
            <select
              id="edit-lot-entreprise-principale"
              value={selectedEntrepriseId}
              onChange={(e) => setSelectedEntrepriseId(e.target.value)}
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            >
              <option value="">-- Aucune entreprise principale --</option>
              {toutesLesEntreprises.map((entreprise) => (
                <option key={entreprise.id} value={entreprise.id}>{entreprise.nom} {entreprise.contact_nom ? `(${entreprise.contact_nom})` : ''}</option>
              ))}
            </select>
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