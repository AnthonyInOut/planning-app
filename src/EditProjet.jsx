import React, { useState, useEffect } from 'react'; // Assurez-vous que React est importé
import { supabase } from './lib/supabaseClient';
import { shadeColor } from './utils/colorUtils'; // Importer shadeColor

const EditProjet = ({ projet, usersList, onSave, onDelete, onClose }) => { // Ajout de usersList
  const [nomProjet, setNomProjet] = useState('');
  const [couleurProjet, setCouleurProjet] = useState('#4a90e2');
  const [selectedUserId, setSelectedUserId] = useState(''); // État pour l'utilisateur assigné
  const [message, setMessage] = useState(''); // État pour les messages à l'utilisateur
  const [isLoading, setIsLoading] = useState(false); // Added isLoading state
  const [isDeleting, setIsDeleting] = useState(false); // Pour gérer l'état de confirmation de suppression

  useEffect(() => {
    if (projet) {
      setNomProjet(projet.nom || '');
      console.log('[EditProjet useEffect] Projet reçu, couleur initiale:', projet.color);
      setCouleurProjet(projet.color || '#4a90e2'); // Initialize with existing color (ensure 'projet.color' is correct)
      setMessage(''); // Réinitialiser le message lors du chargement d'un nouveau projet
      setSelectedUserId(projet.user_id || ''); // Initialiser avec l'user_id existant ou une chaîne vide
    }
  }, [projet]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!nomProjet.trim()) {
      setMessage('Le nom du projet ne peut pas être vide.');
      return;
    }
    if (!projet || !projet.id) {
      setMessage('Erreur : ID du projet manquant.');
      return;
    }
    setIsLoading(true);
    const payload = { 
        nom: nomProjet.trim(), 
        color: couleurProjet,
        user_id: selectedUserId || null // Assurer que c'est null si vide
    };
    console.log('[EditProjet handleSave] Payload à envoyer à Supabase:', payload);
    console.log('[EditProjet handleSave] ID du projet:', projet.id);

    const { data: updatedProjetData, error: projetUpdateError } = await supabase
      .from('projets')
      .update(payload)
      .eq('id', projet.id)
      .select() // Pour obtenir les données mises à jour du projet
      .single(); // Nous attendons un seul projet en retour

    if (projetUpdateError) {
      console.error('[EditProjet handleSave] Erreur Supabase lors de la mise à jour du projet:', projetUpdateError);
      setMessage(`Erreur lors de la mise à jour du projet : ${projetUpdateError.message}`);
      setIsLoading(false);
      return;
    } else {
      console.log('[EditProjet handleSave] Projet mis à jour avec succès !');

      // Maintenant, mettons à jour les couleurs des lots associés
      if (updatedProjetData && projet.lots && projet.lots.length > 0) {
        const newProjectColor = updatedProjetData.color;
        // Séquence de nuances à appliquer aux lots.
        // Vous pouvez ajuster ces valeurs ou les rendre plus dynamiques.
        const lotShadeSteps = [0, -15, 15, -25, 25, -10, 10]; 

        const lotUpdatePromises = projet.lots.map((lot, index) => {
          const newLotColor = shadeColor(newProjectColor, lotShadeSteps[index % lotShadeSteps.length]);
          console.log(`[EditProjet handleSave] Mise à jour du lot ID ${lot.id} avec la nouvelle couleur ${newLotColor}`);
          return supabase
            .from('lots')
            .update({ color: newLotColor })
            .eq('id', lot.id);
        });

        try {
          await Promise.all(lotUpdatePromises);
          console.log('[EditProjet handleSave] Couleurs des lots mises à jour avec succès.');
        } catch (lotUpdateErrors) {
          // Gérer l'erreur de mise à jour des lots si nécessaire, mais le projet principal est déjà mis à jour.
          console.warn('[EditProjet handleSave] Erreur lors de la mise à jour des couleurs des lots:', lotUpdateErrors);
        }
      }
      setMessage('Projet et couleurs des lots associés mis à jour avec succès !');
      onSave(); // Appelle la fonction de rappel pour rafraîchir toutes les données et fermer
    }
    setIsLoading(false);
  };

  const handleDelete = async () => {
    if (!projet || !projet.id) {
      setMessage('Erreur : ID du projet manquant.');
      return;
    }

    // Note: La suppression en cascade des lots et interventions associés
    // devrait idéalement être gérée par des contraintes 'ON DELETE CASCADE'
    // dans votre base de données Supabase.
    // Si ce n'est pas le cas, vous devrez ajouter ici la logique pour supprimer
    // manuellement les lots et interventions liés avant de supprimer le projet.

    const { error } = await supabase
      .from('projets')
      .delete()
      .eq('id', projet.id);

    if (error) {
      setMessage(`Erreur lors de la suppression du projet : ${error.message}`);
    } else {
      setMessage('Projet supprimé avec succès !');
      onDelete(); // Appelle la fonction de rappel pour rafraîchir et fermer
    }
  };

  if (!projet) return null;

  return (
    <div style={{ padding: '1rem' }}>
      <form onSubmit={handleSave}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="projet-nom-edit" style={{ display: 'block', marginBottom: '5px' }}>Nom du projet :</label>
          <input
            type="text"
            id="projet-nom-edit"
            value={nomProjet}
            onChange={(e) => setNomProjet(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="edit-couleurProjet" style={{ display: 'block', marginBottom: '5px' }}>Couleur du projet :</label>
          <input
            type="color"
            id="edit-couleurProjet"
            value={couleurProjet}
            onChange={(e) => {
              console.log('[EditProjet onChange couleur] Nouvelle couleur sélectionnée:', e.target.value);
              setCouleurProjet(e.target.value);
            }}
            style={{ width: '100%', padding: '3px', boxSizing: 'border-box', height: '40px' }} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="userProjet-edit" style={{ display: 'block', marginBottom: '5px' }}>Assigné à :</label>
          <select id="userProjet-edit" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}>
            <option value="">Non assigné</option>
            {usersList && usersList.map(user => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="submit" disabled={isLoading} style={{ padding: '8px 15px' }}>
            {isLoading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          {!isDeleting ? (
            <button type="button" onClick={() => setIsDeleting(true)} disabled={isLoading} style={{ padding: '8px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}>
              Supprimer
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span>Confirmer ?</span>
              <button type="button" onClick={handleDelete} style={{ padding: '8px 15px', backgroundColor: '#c82333', color: 'white', border: 'none', borderRadius: '4px' }}>Oui, supprimer</button>
              <button type="button" onClick={() => setIsDeleting(false)} style={{ padding: '8px 15px' }}>Annuler</button>
            </div>
          )}
        </div>
      </form>
      {message && <p style={{ marginTop: '1rem', textAlign: 'center' }}>{message}</p>}
    </div>
  );
};
export default EditProjet;
