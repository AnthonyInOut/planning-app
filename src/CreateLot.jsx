import { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { findAvailableShade } from './utils/colorUtils'; // Importer la nouvelle fonction

const CreateLot = ({ onAjout, projetId: parentProjetId, parentProjet, siblingLots, onOpenGestionEntreprisesModal }) => {
  const [nom, setNom] = useState('');
  const [selectedEntrepriseId, setSelectedEntrepriseId] = useState(''); // Pour l'entreprise principale unique
  const [loadingEntreprises, setLoadingEntreprises] = useState(true); // Nouvel état de chargement
  const [couleurLot, setCouleurLot] = useState('#cccccc');
  const [toutesLesEntreprises, setToutesLesEntreprises] = useState([]); // État pour la liste de toutes les entreprises
  // Les états pour la création d'entreprise inline sont supprimés
  // const [showCreateEntrepriseForm, setShowCreateEntrepriseForm] = useState(false);
  // const [newEntrepriseName, setNewEntrepriseName] = useState('');
  // const [isCreatingEntreprise, setIsCreatingEntreprise] = useState(false);
  // projetId est maintenant une prop, pas un état local.
  // La liste complète des projets n'est plus nécessaire ici.

  // Charger la liste des entreprises pour la dropdown
  useEffect(() => {
    const fetchEntreprises = async () => {
      console.log("Attempting to fetch entreprises..."); // Log de début de fetch
      setLoadingEntreprises(true); // Début du chargement
      const { data, error } = await supabase.from('entreprises').select('id, nom, contact_nom'); // Récupérer aussi contact_nom
      if (error) {
        console.error("Error fetching entreprises:", error);
        setToutesLesEntreprises([]); // Mettre à un tableau vide en cas d'erreur
        // Optionnel: setFetchError("Impossible de charger les entreprises.");
      } else {
        setToutesLesEntreprises(data || []);
        console.log("Fetched entreprises:", data); // Log pour vérifier les données récupérées
      }
      setLoadingEntreprises(false); // Fin du chargement
    };
    fetchEntreprises();

    // Suggérer une couleur basée sur le projet parent
    if (parentProjet && parentProjet.color && siblingLots) {
      const usedColors = siblingLots.map(l => l.color).filter(Boolean);
      console.log(`[CreateLot useEffect] Appel de findAvailableShade pour projet ${parentProjet.nom} (couleur: ${parentProjet.color}). Couleurs de lots frères utilisées:`, JSON.stringify(usedColors));
      
      const suggestedColor = findAvailableShade(parentProjet.color, usedColors, '#cccccc');
      setCouleurLot(suggestedColor);
       console.log(`[CreateLot useEffect] Couleur suggérée pour le nouveau lot: ${suggestedColor}`);
    
    } else {
      setCouleurLot('#cccccc'); // Couleur par défaut si pas d'info projet
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!parentProjetId) {
      alert("Erreur : L'ID du projet parent est manquant.");
      return;
    }

    // Déterminer le nouvel ordre d'affichage
    // SiblingLots est un tableau, donc sa longueur donne le prochain index (ordre)
    const newOrder = siblingLots ? siblingLots.length : 0;

    const payload = { 
      nom, 
      projet_id: parentProjetId, 
      entreprise_id: selectedEntrepriseId || null, // Sauvegarder l'ID de l'entreprise principale
      color: couleurLot, 
      display_order: newOrder 
    };
    console.log("Submitting Lot:", payload);
    // const { data: newLotData, error: lotInsertError } = await supabase // newLotData n'est plus utilisé ici
    const { error: lotInsertError } = await supabase
      .from('lots')
      .insert([payload])
      .select()
      .single();

    if (lotInsertError) {
      alert('Erreur lors de la création du lot: ' + lotInsertError.message);
      return;
    }

    // La logique pour la table de liaison lots_entreprises est retirée
    alert('Lot ajouté avec succès !');

    setNom('');
    setSelectedEntrepriseId(''); // Réinitialiser l'entreprise sélectionnée
    setCouleurLot('#cccccc'); // Réinitialiser la couleur du lot
    if (onAjout) {
      onAjout(); // 🔁 Rafraîchir la liste des projets/lots après ajout
    }
  };

  const handleOpenCreateEntrepriseModal = () => {
    onOpenGestionEntreprisesModal?.();
  };

  // La fonction handleAddNewEntreprise est supprimée car la création se fait via la modale globale

  return (
    <form onSubmit={handleSubmit}>
      <h2>Ajouter un lot</h2>
      <div>
        <label>Nom du lot :</label>
        <input
          type="text"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          required
        />
      </div>
      <div style={{ margin: '10px 0' }}>
        <label htmlFor="couleurLot-create" style={{ display: 'block', marginBottom: '5px' }}>Couleur du lot :</label>
        <input type="color" id="couleurLot-create" value={couleurLot} onChange={(e) => setCouleurLot(e.target.value)} style={{ width: '100%', padding: '3px', boxSizing: 'border-box', height: '40px' }} />
      </div>

      <div>
        <label htmlFor="create-lot-entreprise-principale">Entreprise principale (optionnel) :</label>
        {loadingEntreprises ? <p>Chargement des entreprises...</p> : (
          <select
            id="create-lot-entreprise-principale"
            value={selectedEntrepriseId}
            onChange={(e) => setSelectedEntrepriseId(e.target.value)}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '10px' }}
          >
            <option value="">-- Aucune entreprise principale --</option>
            {toutesLesEntreprises.map((entreprise) => (
              <option key={entreprise.id} value={entreprise.id}>{entreprise.nom} {entreprise.contact_nom ? `(${entreprise.contact_nom})` : ''}</option>
            ))}
          </select>
        )}
        {/* Bouton pour ouvrir la modale de gestion des entreprises */}
        {!loadingEntreprises && (
           <div style={{marginTop: '10px', marginBottom: '10px'}}>
            <button 
              type="button" 
              onClick={handleOpenCreateEntrepriseModal}
            >
              Créer/Gérer une entreprise
            </button>
          </div>
        )}
      </div> {/* Fermeture du div de la section "Entreprises associées" */}

      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-start', gap: '10px' }}>
        <button type="submit">Ajouter</button> {/* Bouton Ajouter */}
        {/* Bouton Annuler - Appelle onAjout pour fermer la modale */}
        {/* Si onAjout est toujours une fonction valide : */}
        {/* <button type="button" onClick={onAjout}>Annuler</button> */}
        <button type="button" onClick={() => { if (onAjout) onAjout(); }}>Annuler</button> {/* Votre version actuelle est parfaitement sûre */}
      </div>
    </form>
  );
};

export default CreateLot;
