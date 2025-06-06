import { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { findAvailableShade } from './utils/colorUtils'; // Importer la nouvelle fonction

const CreateLot = ({ onAjout, projetId: parentProjetId, parentProjet, siblingLots }) => {
  const [nom, setNom] = useState('');
  const [entrepriseId, setEntrepriseId] = useState(''); // État pour l'entreprise sélectionnée
  const [showCreateEntrepriseForm, setShowCreateEntrepriseForm] = useState(false);
  const [newEntrepriseName, setNewEntrepriseName] = useState('');
  const [isCreatingEntreprise, setIsCreatingEntreprise] = useState(false);
  const [loadingEntreprises, setLoadingEntreprises] = useState(true); // Nouvel état de chargement
  const [couleurLot, setCouleurLot] = useState('#cccccc');
  const [entreprises, setEntreprises] = useState([]); // État pour la liste des entreprises
  // projetId est maintenant une prop, pas un état local.
  // La liste complète des projets n'est plus nécessaire ici.

  // Charger la liste des entreprises pour la dropdown
  useEffect(() => {
    const fetchEntreprises = async () => {
      console.log("Attempting to fetch entreprises..."); // Log de début de fetch
      setLoadingEntreprises(true); // Début du chargement
      const { data, error } = await supabase.from('entreprises').select('id, nom'); // Re-modifié ici pour utiliser le pluriel
      if (error) {
        console.error("Error fetching entreprises:", error);
        setEntreprises([]); // Mettre à un tableau vide en cas d'erreur
        // Optionnel: setFetchError("Impossible de charger les entreprises.");
      } else {
        setEntreprises(data || []);
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

    // Convert entrepriseId string from select to number, or keep null if empty
    const entrepriseIdToSend = entrepriseId === '' ? null : parseInt(entrepriseId, 10);
    
    // Déterminer le nouvel ordre d'affichage
    // SiblingLots est un tableau, donc sa longueur donne le prochain index (ordre)
    const newOrder = siblingLots ? siblingLots.length : 0;

    const payload = { nom, projet_id: parentProjetId, entreprise_id: entrepriseIdToSend, color: couleurLot, display_order: newOrder };
    console.log("Submitting Lot:", payload);
    const { error } = await supabase.from('lots').insert([
      {
        nom,
        projet_id: parentProjetId,
        entreprise_id: entrepriseIdToSend,
        color: couleurLot, // Enregistrer la couleur du lot
        display_order: newOrder // Enregistrer le nouvel ordre d'affichage
      }
    ]);

    if (error) {
      alert('Erreur : ' + error.message);
    } else {
      alert('Lot ajouté avec succès !');
      setNom('');
      setEntrepriseId(''); // Réinitialiser l'entreprise sélectionnée
      setCouleurLot('#cccccc'); // Réinitialiser la couleur du lot
      if (onAjout) {
        onAjout(); // 🔁 Rafraîchir la liste des projets/lots après ajout
      }
    }
  };

  const handleAddNewEntreprise = async () => {
    if (!newEntrepriseName.trim()) {
      alert("Veuillez entrer un nom pour la nouvelle entreprise.");
      return;
    }
    setIsCreatingEntreprise(true);
    const { data: newEntrepriseData, error: insertError } = await supabase
      .from('entreprises')
      .insert([{ nom: newEntrepriseName.trim() }])
      .select() // Pour récupérer l'enregistrement créé avec son ID
      .single(); // Nous attendons un seul enregistrement en retour

    setIsCreatingEntreprise(false);

    if (insertError) {
      console.error("Error creating new entreprise:", insertError);
      alert(`Erreur lors de la création de l'entreprise : ${insertError.message}`);
    } else if (newEntrepriseData) {
      alert(`Entreprise "${newEntrepriseData.nom}" ajoutée avec succès !`);
      // Ajoute la nouvelle entreprise à la liste existante
      setEntreprises(prevEntreprises => [...prevEntreprises, newEntrepriseData]);
      // Sélectionne automatiquement la nouvelle entreprise dans le dropdown
      setEntrepriseId(String(newEntrepriseData.id)); // L'ID doit être une chaîne pour la valeur du select
      setShowCreateEntrepriseForm(false); // Cache le formulaire de création
      setNewEntrepriseName(''); // Réinitialise le champ de nom
    } else {
      alert("Un problème est survenu lors de la création de l'entreprise, aucune donnée retournée.");
    }
  };

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
        <label>Entreprise associée (optionnel) :</label>
        <select
          style={{ marginRight: showCreateEntrepriseForm ? '0' : '10px' }} // Ajuste la marge si le formulaire de création est masqué
          value={entrepriseId}
          onChange={(e) => setEntrepriseId(e.target.value)}
          disabled={loadingEntreprises || showCreateEntrepriseForm} // Désactive le select pendant le chargement ou si le formulaire de création est affiché
        >
          <option value="">
            {loadingEntreprises 
              ? "Chargement..." 
              : entreprises.length === 0 && !showCreateEntrepriseForm 
              ? "-- Aucune entreprise disponible --" 
              : "-- Aucune --"}
          </option>
          {entreprises.map((entreprise) => (
            <option key={entreprise.id} value={String(entreprise.id)}> {/* Assure que la valeur est une chaîne */}
              {entreprise.nom}
            </option>
          ))}
        </select>
        {!showCreateEntrepriseForm && !loadingEntreprises && (
          <button type="button" onClick={() => setShowCreateEntrepriseForm(true)}>
            Créer une entreprise
          </button>
        )}
      </div>

      {showCreateEntrepriseForm && (
        <div style={{ border: '1px solid #eee', padding: '10px', marginTop: '10px', backgroundColor: '#f9f9f9' }}>
          <h4>Nouvelle entreprise</h4>
          <div>
            <label htmlFor="new-entreprise-name" style={{ marginRight: '5px' }}>Nom :</label>
            <input
              type="text"
              id="new-entreprise-name"
              value={newEntrepriseName}
              onChange={(e) => setNewEntrepriseName(e.target.value)}
              disabled={isCreatingEntreprise}
            />
          </div>
          <div style={{ marginTop: '10px' }}>
            <button type="button" onClick={handleAddNewEntreprise} disabled={isCreatingEntreprise} style={{ marginRight: '5px' }}>
              {isCreatingEntreprise ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button type="button" onClick={() => { setShowCreateEntrepriseForm(false); setNewEntrepriseName(''); }} disabled={isCreatingEntreprise}>
              Annuler
            </button>
          </div>
        </div>
      )}

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
