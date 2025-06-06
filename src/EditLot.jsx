import { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { findAvailableShade } from './utils/colorUtils'; // Importer la nouvelle fonction

const EditLot = ({ lot, onSave, onDelete, onClose, parentProjet, siblingLots }) => {
  const [nomLot, setNomLot] = useState(''); // Changed from 'nom' to 'nomLot' for clarity
  const [entrepriseId, setEntrepriseId] = useState('');
  const [entreprises, setEntreprises] = useState([]);
  const [loadingEntreprises, setLoadingEntreprises] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [couleurLot, setCouleurLot] = useState('#cccccc');
  const [isLoading, setIsLoading] = useState(false); // Added isLoading state

  useEffect(() => {
    if (lot) {
      setNomLot(lot.nom || '');
      setEntrepriseId(lot.entreprise_id ? String(lot.entreprise_id) : '');
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
      const { data, error } = await supabase.from('entreprises').select('id, nom');
      if (error) {
        console.error("Error fetching entreprises for EditLot:", error);
        setEntreprises([]);
      } else {
        setEntreprises(data || []);
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

    const entrepriseIdToSave = entrepriseId === '' ? null : parseInt(entrepriseId, 10);
    const payload = {
      nom: nomLot.trim(), // Use nomLot
      entreprise_id: entrepriseIdToSave,
      color: couleurLot // Include color in the payload
    };
    console.log("Updating Lot with payload:", payload, "for ID:", lot.id);

    const { error } = await supabase
      .from('lots')
      .update(payload)
      .eq('id', lot.id);
    if (error) {
      alert(`Erreur lors de la mise à jour du lot : ${error.message}`);
    } else {
      alert('Lot mis à jour avec succès !');
      onSave();
    }
    setIsLoading(false);
  };

  const handleDelete = async () => {
    if (!lot || !lot.id) {
      alert('Erreur : ID du lot manquant.');
      return;
    }
    // Gérer la suppression des interventions associées si nécessaire (ou via cascade DB)
    const { error } = await supabase.from('lots').delete().eq('id', lot.id);

    if (error) {
      alert(`Erreur lors de la suppression du lot : ${error.message}`);
    } else {
      alert('Lot supprimé avec succès !');
      onDelete();
    }
  };

  if (!lot) return null;

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
          <label htmlFor="lot-entreprise-edit">Entreprise associée (optionnel) :</label>
          <select id="lot-entreprise-edit" value={entrepriseId} onChange={(e) => setEntrepriseId(e.target.value)} disabled={loadingEntreprises} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}>
            <option value="">{loadingEntreprises ? "Chargement..." : (entreprises.length === 0 ? "-- Aucune entreprise disponible --" : "-- Aucune --")}</option>
            {entreprises.map((entreprise) => (
              <option key={entreprise.id} value={String(entreprise.id)}>{entreprise.nom}</option>
            ))}
          </select>
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