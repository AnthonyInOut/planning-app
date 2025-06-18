// GestionSynthesesModal.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient'; // Si vous interagissez avec Supabase pour les configs

const GestionSynthesesModal = ({ isOpen, onClose, usersList, currentUser }) => {
  // --- États pour la configuration d'un envoi automatique ---
  const [nomConfiguration, setNomConfiguration] = useState('');
  const [joursEnvoi, setJoursEnvoi] = useState({ lun: false, mar: false, mer: false, jeu: false, ven: false, sam: false, dim: false });
  const [heureEnvoi, setHeureEnvoi] = useState('08:00');
  const [destinatairesType, setDestinatairesType] = useState('tous'); // 'tous', 'selection'
  const [destinatairesSelectionnes, setDestinatairesSelectionnes] = useState([]); // Array d'user_id

  // --- États pour les paramètres de contenu ---
  const [inclureInterventionsSemaineProchaine, setInclureInterventionsSemaineProchaine] = useState(true);
  const [delaiAlerteDevisDemande, setDelaiAlerteDevisDemande] = useState(7); // en jours
  const [delaiAlerteDevisAttenteValidation, setDelaiAlerteDevisAttenteValidation] = useState(7); // en jours
  const [delaiAlerteInterventionProche, setDelaiAlerteInterventionProche] = useState(28); // 4 semaines = 28 jours
  const [delaiAlerteValidationArtisan, setDelaiAlerteValidationArtisan] = useState(21); // 3 semaines = 21 jours
  const [inclureInterventionsANePasOublier, setInclureInterventionsANePasOublier] = useState(true);

  const [configurationEnEditionId, setConfigurationEnEditionId] = useState(null); // Pour savoir si on édite
  const [configurationsExistantes, setConfigurationsExistantes] = useState([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const joursSemaineMap = {
    lun: 1, mar: 2, mer: 3, jeu: 4, ven: 5, sam: 6, dim: 0
  };
  const joursSemaineInverseMap = {
    1: 'lun', 2: 'mar', 3: 'mer', 4: 'jeu', 5: 'ven', 6: 'sam', 0: 'dim'
  };

  const fetchConfigurations = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('configurations_synthese')
      .select('*')
      .order('nom_configuration', { ascending: true });

    if (error) {
      console.error("Erreur chargement configurations:", error);
      setMessage(`Erreur chargement configs: ${error.message}`);
      setConfigurationsExistantes([]);
    } else {
      setConfigurationsExistantes(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchConfigurations();
      resetForm(); // Réinitialiser le formulaire à l'ouverture
    }
  }, [isOpen]);

  const resetForm = () => {
    setNomConfiguration('');
    setJoursEnvoi({ lun: false, mar: false, mer: false, jeu: false, ven: false, sam: false, dim: false });
    setHeureEnvoi('08:00');
    setDestinatairesType('tous');
    setDestinatairesSelectionnes([]);
    setInclureInterventionsSemaineProchaine(true);
    setDelaiAlerteDevisDemande(7);
    setDelaiAlerteDevisAttenteValidation(7);
    setDelaiAlerteInterventionProche(28);
    setDelaiAlerteValidationArtisan(21);
    setInclureInterventionsANePasOublier(true);
    setConfigurationEnEditionId(null);
    setMessage('');
  };

  const populateFormForEdit = (config) => {
    setConfigurationEnEditionId(config.id);
    setNomConfiguration(config.nom_configuration);
    
    const joursActifs = { lun: false, mar: false, mer: false, jeu: false, ven: false, sam: false, dim: false };
    (config.jours_envoi || []).forEach(jourNum => {
      if (joursSemaineInverseMap[jourNum] !== undefined) {
        joursActifs[joursSemaineInverseMap[jourNum]] = true;
      }
    });
    setJoursEnvoi(joursActifs);

    setHeureEnvoi(config.heure_envoi ? config.heure_envoi.substring(0, 5) : '08:00'); // Format HH:MM
    setDestinatairesType(config.destinataires_type);
    setDestinatairesSelectionnes(config.destinataires_ids || []);
    
    setInclureInterventionsSemaineProchaine(config.contenu_interventions_semaine_prochaine);
    setDelaiAlerteDevisDemande(config.contenu_delai_alerte_devis_demande_jours);
    setDelaiAlerteDevisAttenteValidation(config.contenu_delai_alerte_devis_attente_validation_jours);
    setDelaiAlerteInterventionProche(config.contenu_delai_alerte_intervention_proche_jours);
    setDelaiAlerteValidationArtisan(config.contenu_delai_alerte_validation_artisan_jours);
    setInclureInterventionsANePasOublier(config.contenu_interventions_a_ne_pas_oublier);
    setMessage('');
  };

  const handleSaveConfiguration = async () => {
    if (!nomConfiguration.trim()) {
      setMessage("Le nom de la configuration est requis.");
      return;
    }
    setIsLoading(true);
    const joursActifsNumeriques = Object.entries(joursEnvoi)
      .filter(([key, value]) => value === true)
      .map(([key]) => joursSemaineMap[key]);

    const payload = {
      nom_configuration: nomConfiguration.trim(),
      jours_envoi: joursActifsNumeriques,
      heure_envoi: heureEnvoi ? `${heureEnvoi}:00` : null, // Assurer le format HH:MM:SS pour Supabase TIME
      destinataires_type: destinatairesType,
      destinataires_ids: destinatairesType === 'selection' ? destinatairesSelectionnes : [],
      active: true, // Par défaut active, pourrait être un champ du formulaire
      contenu_interventions_semaine_prochaine: inclureInterventionsSemaineProchaine,
      contenu_delai_alerte_devis_demande_jours: delaiAlerteDevisDemande,
      contenu_delai_alerte_devis_attente_validation_jours: delaiAlerteDevisAttenteValidation,
      contenu_delai_alerte_intervention_proche_jours: delaiAlerteInterventionProche,
      contenu_delai_alerte_validation_artisan_jours: delaiAlerteValidationArtisan,
      contenu_interventions_a_ne_pas_oublier: inclureInterventionsANePasOublier,
      user_id_creation: currentUser?.id // Optionnel: stocker qui a créé/modifié
    };

    let error;
    if (configurationEnEditionId) {
      // Mise à jour
      const { error: updateError } = await supabase
        .from('configurations_synthese')
        .update(payload)
        .eq('id', configurationEnEditionId);
      error = updateError;
    } else {
      // Création
      const { error: insertError } = await supabase
        .from('configurations_synthese')
        .insert([payload]);
      error = insertError;
    }

    if (error) {
      setMessage(`Erreur: ${error.message}`);
      console.error("Erreur sauvegarde configuration:", error);
    } else {
      setMessage(configurationEnEditionId ? 'Configuration mise à jour !' : 'Configuration sauvegardée !');
      fetchConfigurations();
      resetForm();
    }
    setIsLoading(false);
  };

  const handleEnvoyerSyntheseManuelle = async () => {
    // TODO: Logique pour déclencher l'envoi manuel
    // Pourrait ouvrir une autre petite modale pour choisir les destinataires de cet envoi ponctuel
    // Puis appeler une fonction Supabase.
    alert('Envoi manuel de la synthèse (simulation).');
  };

  const handleDeleteConfiguration = async (configId) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette configuration ?")) {
      setIsLoading(true);
      const { error } = await supabase.from('configurations_synthese').delete().eq('id', configId);
      if (error) {
        setMessage(`Erreur suppression: ${error.message}`);
      } else {
        setMessage('Configuration supprimée.');
        fetchConfigurations();
        if (configurationEnEditionId === configId) resetForm(); // Si on éditait celle qu'on supprime
      }
      setIsLoading(false);
    }
  };
  const joursSemaine = [
    { key: 'lun', label: 'Lundi' }, { key: 'mar', label: 'Mardi' }, { key: 'mer', label: 'Mercredi' },
    { key: 'jeu', label: 'Jeudi' }, { key: 'ven', label: 'Vendredi' }, { key: 'sam', label: 'Samedi' },
    { key: 'dim', label: 'Dimanche' }
  ];

  if (!isOpen) return null;

  return (
    <div style={{ padding: '20px', maxHeight: '80vh', overflowY: 'auto', width: '600px' }}>
      <h3 style={{ marginTop: 0 }}>Gestion des Synthèses par Mail</h3>

      <section style={{ marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
        <h4>{configurationEnEditionId ? 'Modifier la configuration' : "Configurer un nouvel envoi automatique"}</h4>
        <div>
          <label htmlFor="nomConfig">Nom de la configuration :</label>
          <input type="text" id="nomConfig" value={nomConfiguration} onChange={(e) => setNomConfiguration(e.target.value)} placeholder="Ex: Synthèse hebdomadaire Projets Cynthia" style={{width: '100%', padding:'8px', boxSizing:'border-box', marginBottom:'10px'}}/>
        </div>
        <div>
          <label>Jours d'envoi :</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
            {joursSemaine.map(jour => (
              <label key={jour.key} style={{display:'flex', alignItems:'center'}}>
                <input
                  type="checkbox"
                  checked={joursEnvoi[jour.key]}
                  onChange={(e) => setJoursEnvoi(prev => ({ ...prev, [jour.key]: e.target.checked }))}
                  style={{marginRight:'5px'}}
                /> {jour.label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="heureEnvoi">Heure d'envoi :</label>
          <input type="time" id="heureEnvoi" value={heureEnvoi} onChange={(e) => setHeureEnvoi(e.target.value)} style={{padding:'8px', marginBottom:'10px'}}/>
        </div>
        <div>
          <label>Destinataires :</label>
          <select value={destinatairesType} onChange={(e) => setDestinatairesType(e.target.value)} style={{width: '100%', padding:'8px', boxSizing:'border-box', marginBottom:'10px'}}>
            <option value="tous">Tous les utilisateurs actifs</option>
            <option value="selection">Sélection d'utilisateurs</option>
            {/* <option value="currentUser">Utilisateur actuel ({currentUser?.name})</option> */}
          </select>
          {destinatairesType === 'selection' && (
            <div>
              <label style={{display: 'block', marginBottom:'5px'}}>Choisir les utilisateurs :</label>
              <select
                multiple
                value={destinatairesSelectionnes}
                onChange={(e) => setDestinatairesSelectionnes(Array.from(e.target.selectedOptions, option => option.value))}
                style={{width: '100%', minHeight:'80px', padding:'8px', boxSizing:'border-box', marginBottom:'10px'}}
              >
                {usersList.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
              <small>Maintenez Ctrl (ou Cmd sur Mac) pour sélectionner plusieurs utilisateurs.</small>
            </div>
          )}
        </div>

        <h5 style={{marginTop:'15px', marginBottom:'5px'}}>Paramètres du contenu :</h5>
        <label style={{display:'block', marginBottom:'5px'}}><input type="checkbox" checked={inclureInterventionsSemaineProchaine} onChange={e => setInclureInterventionsSemaineProchaine(e.target.checked)} /> Inclure interventions semaine prochaine</label>
        <label style={{display:'block', marginBottom:'5px'}}><input type="checkbox" checked={inclureInterventionsANePasOublier} onChange={e => setInclureInterventionsANePasOublier(e.target.checked)} /> Inclure interventions "À ne pas oublier"</label>
        <div style={{display:'flex', alignItems:'center', marginBottom:'5px'}}>
            Alerter si devis demandé depuis plus de <input type="number" value={delaiAlerteDevisDemande} onChange={e => setDelaiAlerteDevisDemande(parseInt(e.target.value))} style={{width:'50px', marginLeft:'5px', marginRight:'5px'}}/> jours.
        </div>
        <div style={{display:'flex', alignItems:'center', marginBottom:'5px'}}>
            Alerter si devis en attente de validation depuis plus de <input type="number" value={delaiAlerteDevisAttenteValidation} onChange={e => setDelaiAlerteDevisAttenteValidation(parseInt(e.target.value))} style={{width:'50px', marginLeft:'5px', marginRight:'5px'}}/> jours.
        </div>
        <div style={{display:'flex', alignItems:'center', marginBottom:'5px'}}>
            Alerter si intervention prévue dans <input type="number" value={delaiAlerteInterventionProche} onChange={e => setDelaiAlerteInterventionProche(parseInt(e.target.value))} style={{width:'50px', marginLeft:'5px', marginRight:'5px'}}/> jours ou moins.
        </div>
        <div style={{display:'flex', alignItems:'center', marginBottom:'5px'}}>
            Alerter si validation artisan attendue dans <input type="number" value={delaiAlerteValidationArtisan} onChange={e => setDelaiAlerteValidationArtisan(parseInt(e.target.value))} style={{width:'50px', marginLeft:'5px', marginRight:'5px'}}/> jours ou moins.
        </div>

        <button onClick={handleSaveConfiguration} disabled={isLoading || !nomConfiguration.trim()} style={{marginTop:'10px', marginRight:'10px'}}>
          {isLoading ? 'Sauvegarde...' : (configurationEnEditionId ? 'Mettre à jour Configuration' : 'Sauvegarder Configuration')}
        </button>
        {configurationEnEditionId && (
          <button type="button" onClick={resetForm} disabled={isLoading} style={{marginTop:'10px'}}>Annuler l'édition / Créer nouveau</button>
        )}
      </section>

      <section style={{ marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
        <h4>Configurations Automatiques Existantes</h4>
        {isLoading && configurationsExistantes.length === 0 && <p>Chargement...</p>}
        {!isLoading && configurationsExistantes.length === 0 && <p>Aucune configuration automatique enregistrée.</p>}
        <ul style={{listStyle:'none', paddingLeft:0}}>
          {configurationsExistantes.map(config => (
            <li key={config.id} style={{border:'1px solid #ddd', padding:'10px', marginBottom:'10px', borderRadius:'4px'}}>
              <strong>{config.nom_configuration}</strong>
              <div style={{fontSize:'0.9em'}}>
                Jours: {(config.jours_envoi || []).map(j => joursSemaine.find(js => joursSemaineMap[js.key] === j)?.label || `Jour ${j}`).join(', ') || 'Non défini'}
                <br/>
                Heure: {config.heure_envoi ? config.heure_envoi.substring(0,5) : 'Non définie'}
                <br/>
                Destinataires: {config.destinataires_type === 'tous' ? 'Tous' : `Sélection (${(config.destinataires_ids || []).length})`}
              </div>
              <button onClick={() => populateFormForEdit(config)} style={{marginRight:'5px', marginTop:'5px'}}>Modifier</button>
              <button onClick={() => handleDeleteConfiguration(config.id)} style={{backgroundColor:' #ffdddd', marginTop:'5px'}}>Supprimer</button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h4>Envoi Manuel</h4>
        <p>Envoyer une synthèse maintenant (utilisera les paramètres par défaut ou une configuration à choisir).</p>
        <button onClick={handleEnvoyerSyntheseManuelle} disabled={isLoading}>
          {isLoading ? 'Envoi...' : 'Envoyer une Synthèse Manuellement'}
        </button>
      </section>
      
      {message && <p style={{marginTop:'15px', color: message.startsWith('Erreur') ? 'red' : 'green'}}>{message}</p>}

      <button onClick={onClose} style={{ marginTop: '20px', padding: '10px 20px' }}>Fermer</button>
    </div>
  );
};

export default GestionSynthesesModal;
