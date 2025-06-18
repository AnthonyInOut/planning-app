// c:\Users\Cynthia\planning-app\planning-app\src\GestionEntreprisesModal.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';

const GestionEntreprisesModal = ({ isOpen, onClose, onEntrepriseAddedOrUpdated }) => {
  const [entreprises, setEntreprises] = useState([]);
  const [nomEntreprise, setNomEntreprise] = useState('');
  const [contactNom, setContactNom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [adresse, setAdresse] = useState('');
  const [entrepriseEnEdition, setEntrepriseEnEdition] = useState(null); // Null pour création, objet entreprise pour édition
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedEntrepriseIdForDropdown, setSelectedEntrepriseIdForDropdown] = useState(''); // Pour le menu déroulant
  const [uniqueSocietes, setUniqueSocietes] = useState([]); // Pour le dropdown des sociétés (nom + adresse)
  const [selectedSocieteKey, setSelectedSocieteKey] = useState(''); // Clé pour la société sélectionnée (nom|adresse)

  const fetchEntreprises = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('entreprises').select('*').order('nom', { ascending: true });
    if (error) {
      console.error("Erreur lors de la récupération des entreprises:", error);
      setMessage(`Erreur: ${error.message}`);
    } else {
      const sortedData = (data || []).sort((a, b) => 
        a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' })
      );
      setEntreprises(sortedData);

      // Créer une liste de "sociétés" uniques basées sur nom + adresse
      const societesMap = new Map();
      (sortedData || []).forEach(e => { // Utiliser sortedData pour la cohérence si nécessaire
        const key = `${e.nom}|${e.adresse || ''}`; // Clé unique pour nom + adresse
        if (!societesMap.has(key)) {
          societesMap.set(key, { nom: e.nom, adresse: e.adresse || '' });
        }
      });
      setUniqueSocietes(Array.from(societesMap.values()));
    }
    setIsLoading(false);
  };

  const resetFormFields = () => {
    setNomEntreprise('');
    setContactNom('');
    setEmail('');
    setTelephone('');
    setAdresse('');
    setMessage('');
  };

  // Passe en mode création : vide le formulaire, désélectionne l'entreprise en édition et les dropdowns
  const switchToCreateMode = () => {
    resetFormFields();
    setEntrepriseEnEdition(null);
    setSelectedEntrepriseIdForDropdown(''); // Synchronise le dropdown
    setSelectedSocieteKey(''); // Réinitialise la sélection de société
  };


  // Remplit le formulaire avec les données d'une entreprise pour l'édition
  const populateFormForEdit = (entreprise) => {
    setEntrepriseEnEdition(entreprise);
    setNomEntreprise(entreprise.nom);
    setContactNom(entreprise.contact_nom || '');
    setEmail(entreprise.email || '');
    setTelephone(entreprise.telephone || '');
    setAdresse(entreprise.adresse || '');
    setMessage('');
    // setSelectedEntrepriseIdForDropdown(entreprise.id.toString()); // Ne pas synchroniser ce dropdown lors de l'édition d'un intervenant spécifique
    // Mettre à jour la sélection de société si l'entreprise éditée correspond à une société
    const societeKey = `${entreprise.nom}|${entreprise.adresse || ''}`;
    setSelectedSocieteKey(societeKey);

  };

  useEffect(() => {
    if (isOpen) {
      fetchEntreprises();
      switchToCreateMode(); // Par défaut, la modale s'ouvre en mode création
    }
  }, [isOpen]);

  // Gère les changements de sélection dans le menu déroulant
  // Cet useEffect est pour le dropdown des intervenants existants (pour édition directe)
  useEffect(() => {
    if (!isOpen) return; // Ne rien faire si la modale n'est pas ouverte

    if (selectedEntrepriseIdForDropdown) { // Si une entreprise est sélectionnée dans le dropdown
      const entrepriseToEdit = entreprises.find(e => e.id.toString() === selectedEntrepriseIdForDropdown);
      if (entrepriseToEdit && (!entrepriseEnEdition || entrepriseEnEdition.id !== entrepriseToEdit.id)) {
        // On édite cet intervenant spécifique
        populateFormForEdit(entrepriseToEdit);
      }
    } else if (!selectedSocieteKey) { // Si aucun intervenant spécifique ET aucune société n'est sélectionnée
      if (entrepriseEnEdition) { // Si on était en train d'éditer, on repasse en mode création pure
        switchToCreateMode();
      }
    }
  }, [selectedEntrepriseIdForDropdown, isOpen]); // entreprises et entrepriseEnEdition retirés pour éviter des boucles

  // Gère la sélection d'une "société" (nom + adresse) pour pré-remplir
  useEffect(() => {
    if (!isOpen || !selectedSocieteKey) return;
    const societe = uniqueSocietes.find(s => `${s.nom}|${s.adresse}` === selectedSocieteKey);
    if (societe) {
      setNomEntreprise(societe.nom); // Pré-remplir le nom de l'entreprise
      setAdresse(societe.adresse);   // Pré-remplir l'adresse
      // Les champs contact, email, tel restent vides pour le nouvel intervenant
      // On ne met PAS setEntrepriseEnEdition ici, car on crée un NOUVEL intervenant pour cette société
    }
  }, [selectedSocieteKey, isOpen, uniqueSocietes]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nomEntreprise.trim()) {
      setMessage("Le nom de l'entreprise ne peut pas être vide.");
      return;
    }
    setIsLoading(true);
    setMessage('');

    const payload = {
      nom: nomEntreprise.trim(),
      contact_nom: contactNom.trim() || null,
      email: email.trim() || null,
      telephone: telephone.trim() || null,
      adresse: adresse.trim() || null,
    };

    let error;
    let successMessage = '';

    // Si entrepriseEnEdition est défini ET selectedEntrepriseIdForDropdown correspond, c'est une MISE A JOUR d'un intervenant existant.
    // Sinon, c'est une CREATION (soit un tout nouvel intervenant pour une nouvelle société, soit un nouvel intervenant pour une société existante).
    if (entrepriseEnEdition && selectedEntrepriseIdForDropdown === entrepriseEnEdition.id.toString()) {
      const { error: updateError } = await supabase
        .from('entreprises')
        .update(payload)
        .eq('id', entrepriseEnEdition.id);
      error = updateError;
      successMessage = 'Entreprise mise à jour !';
    } else { // Mode création (nouvel intervenant)
      const { error: insertError } = await supabase
        .from('entreprises')
        .insert([payload]);
      error = insertError;
      successMessage = 'Entreprise ajoutée !';
    }

    if (error) {
      console.error("Erreur lors de la sauvegarde de l'entreprise:", error);
      setMessage(`Erreur: ${error.message}`);
    } else {
      setMessage(successMessage);
      await fetchEntreprises(); // Rafraîchir la liste pour avoir les dernières données (et le nouvel ID si création)
      switchToCreateMode();   // Réinitialiser le formulaire en mode création
      onEntrepriseAddedOrUpdated?.(); // Informer le parent si nécessaire
    }
    setIsLoading(false);
  };

  // Appelé lorsque l'utilisateur clique sur "Modifier" dans la liste des entreprises en bas
  const handleEditFromList = (entreprise) => {
    populateFormForEdit(entreprise);
  };

  const handleDelete = async (entrepriseId) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette entreprise ? Cela pourrait affecter les lots associés.")) {
      setIsLoading(true);
      // Si l'entreprise en cours d'édition est celle qu'on supprime, repasser en mode création
      if (entrepriseEnEdition && entrepriseEnEdition.id === entrepriseId) {
        switchToCreateMode();
      }
      const { error } = await supabase.from('entreprises').delete().eq('id', entrepriseId);
      if (error) {
        console.error("Erreur lors de la suppression de l'entreprise:", error);
        setMessage(`Erreur: ${error.message}`);
      } else {
        setMessage('Entreprise supprimée !');
        fetchEntreprises(); // Rafraîchir la liste
        // onEntrepriseAddedOrUpdated?.(); // Déjà géré par le fetch et le reset si besoin
      }
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ padding: '20px', maxHeight: '80vh', overflowY: 'auto' }}>
      <h3 style={{ marginTop: 0 }}>Gestion des Entreprises</h3>
      {/* Dropdown pour sélectionner une "société" existante pour pré-remplir nom/adresse */}
      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="selectSociete" style={{display: 'block', marginBottom: '5px'}}>Société existante (pour Nom/Adresse) :</label>
        <select
          id="selectSociete"
          value={selectedSocieteKey}
          onChange={(e) => {
            setSelectedSocieteKey(e.target.value);
            // Si on sélectionne une société, on ne veut plus éditer un intervenant spécifique
            setSelectedEntrepriseIdForDropdown(''); 
            setEntrepriseEnEdition(null);
            // Les champs contact, email, tel seront à remplir
            setContactNom(''); setEmail(''); setTelephone('');
          }}
          style={{ padding: '8px', width: '100%', boxSizing: 'border-box' }}
        >
          <option value="">-- Nouvelle société (entrer Nom/Adresse manuellement) --</option>
          {uniqueSocietes.map(s => {
            const key = `${s.nom}|${s.adresse}`;
            return <option key={key} value={key}>{s.nom} ({s.adresse || 'Adresse non spécifiée'})</option>;
          })}
        </select>
      </div>

      <form onSubmit={handleSubmit} style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Champ Nom Entreprise */}
        <div>
          <label htmlFor="nomEntreprise" style={{display: 'block', marginBottom: '2px'}}>Nom de l'entreprise *</label>
          <input
            id="nomEntreprise"
            type="text"
            placeholder="Nom de l'entreprise"
            value={nomEntreprise}
            onChange={(e) => setNomEntreprise(e.target.value)}
            required
            // Change le fond si on est en mode édition pour indiquer que le nom vient d'une entité existante
            style={{ padding: '8px', width: '100%', boxSizing: 'border-box', backgroundColor: (entrepriseEnEdition || selectedSocieteKey) ? '#f0f0f0' : 'white' }}
            readOnly={!!selectedSocieteKey && !entrepriseEnEdition} // Non modifiable si société sélectionnée et pas en édition d'intervenant
          />
        </div>
        {/* Champ Adresse */}
        <div>
          <label htmlFor="adresse" style={{display: 'block', marginBottom: '2px'}}>Adresse</label>
          <textarea
            id="adresse"
            placeholder="Adresse"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            style={{ padding: '8px', width: '100%', boxSizing: 'border-box', minHeight: '60px', backgroundColor: (entrepriseEnEdition || selectedSocieteKey) ? '#f0f0f0' : 'white' }}
            readOnly={!!selectedSocieteKey && !entrepriseEnEdition} // Non modifiable si société sélectionnée et pas en édition d'intervenant
          />
        </div>
        <hr />
        <p style={{marginTop: 0, marginBottom: '10px', fontWeight:'bold'}}>Détails de l'intervenant :</p>
        {/* Champs pour l'intervenant spécifique */}
        <div>
          <label htmlFor="contactNom" style={{display: 'block', marginBottom: '2px'}}>Nom du contact (intervenant) *</label>
          <input
            id="contactNom"
            type="text"
            placeholder="Nom du contact"
            value={contactNom}
            onChange={(e) => setContactNom(e.target.value)}
            required // Le nom du contact est maintenant requis
            style={{ padding: '8px', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label htmlFor="email" style={{display: 'block', marginBottom: '2px'}}>Email (intervenant)</label>
          <input
            id="email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: '8px', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label htmlFor="telephone" style={{display: 'block', marginBottom: '2px'}}>Téléphone (intervenant)</label>
          <input
            id="telephone"
            type="tel"
            placeholder="Téléphone"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            style={{ padding: '8px', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
          <button type="submit" disabled={isLoading} style={{ padding: '8px 15px' }}>
            {isLoading ? 'Chargement...' : (entrepriseEnEdition ? 'Mettre à jour intervenant' : 'Ajouter intervenant')}
          </button>
          {entrepriseEnEdition && (
            <button type="button" onClick={switchToCreateMode} style={{ padding: '8px 15px' }}>
              Annuler l'édition (Créer nouveau)
            </button>
          )}
        </div>
      </form>
      {message && <p>{message}</p>}
      {isLoading && entreprises.length === 0 && <p>Chargement des données...</p>}

      <hr style={{margin: "20px 0"}}/>
      <h4 style={{marginTop: 0}}>Intervenants existants (pour édition/suppression) :</h4>
       <div style={{ marginBottom: '15px' }}>
        <label htmlFor="selectIntervenantPourEdition" style={{display: 'block', marginBottom: '5px'}}>Choisir un intervenant à modifier/supprimer :</label>
        <select
          id="selectEntreprise"
          value={selectedEntrepriseIdForDropdown} // Lié à l'état du dropdown
          onChange={(e) => setSelectedEntrepriseIdForDropdown(e.target.value)} // Met à jour l'état du dropdown
          style={{ padding: '8px', width: '100%', boxSizing: 'border-box' }}
        >
          <option value="">-- Sélectionner un intervenant pour édition --</option>
          {entreprises.map(e => (
            <option key={e.id} value={e.id.toString()}>{e.contact_nom || 'N/A'} ({e.nom})</option>
          ))}
        </select>
      </div>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {entreprises.map(entreprise => (
          <li key={entreprise.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee' }}>
            <div style={{flexGrow: 1}}>
              <strong>{entreprise.nom}</strong>
              {entreprise.contact_nom && (
                <div style={{fontSize: '0.9em', color: '#555', marginLeft: '10px'}}>
                  Intervenant: {entreprise.contact_nom}
                </div>
              )}
              {entreprise.email && <div style={{fontSize: '0.9em', color: '#555'}}>Email: {entreprise.email}</div>}
              {entreprise.telephone && <div style={{fontSize: '0.9em', color: '#555'}}>Tél: {entreprise.telephone}</div>}
              {entreprise.adresse && <div style={{fontSize: '0.9em', color: '#555'}}>Adresse: {entreprise.adresse}</div>}
            </div>
            <div>
              <button onClick={() => handleEditFromList(entreprise)} style={{ marginRight: '10px', padding: '5px 10px' }} disabled={isLoading}>Modifier</button>
              <button onClick={() => handleDelete(entreprise.id)} style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white' }} disabled={isLoading}>Supprimer</button>
            </div>
          </li>
        ))}
      </ul>
      <button onClick={onClose} style={{ marginTop: '20px', padding: '10px 20px' }}>Fermer</button>
    </div>
  );
};

export default GestionEntreprisesModal;
