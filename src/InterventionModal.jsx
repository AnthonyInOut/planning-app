// src/InterventionForm.jsx
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';

const InterventionForm = ({
  onClose,
  interventionData,
  isCreating,
  allLots,
  currentLotId, // ID du lot pour la création
  onSaveSuccess,
  onDeleteSuccess
}) => {
  const [nomIntervention, setNomIntervention] = useState('');
  const [dateIntervention, setDateIntervention] = useState('');
  const [dateFinIntervention, setDateFinIntervention] = useState('');
  const [heureDebutIntervention, setHeureDebutIntervention] = useState('');
  const [heureFinIntervention, setHeureFinIntervention] = useState('');
  const [lotIdIntervention, setLotIdIntervention] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingConfirmation, setIsDeletingConfirmation] = useState(false);

  console.log('[InterventionForm] Props reçues:', { interventionData, isCreating, allLots, currentLotId });

  useEffect(() => {
    console.log('[InterventionForm useEffect] Début - Props:', { interventionData, isCreating, currentLotId });
    // Log pour voir la liste des lots disponibles au moment de l'effet
    if (allLots && allLots.length > 0) {
      console.log('[InterventionForm useEffect] allLots:', allLots);
    } else {
      console.warn('[InterventionForm useEffect] allLots est vide ou non défini.');
    }
    if (isCreating) {
      setNomIntervention(interventionData?.nom || '');
      setDateIntervention(interventionData?.date || '');
      setDateFinIntervention(interventionData?.date_fin || interventionData?.date || '');
      setHeureDebutIntervention(interventionData?.heure_debut || '08:00');
      setHeureFinIntervention(interventionData?.heure_fin || '17:00');
      setLotIdIntervention(currentLotId ? String(currentLotId) : '');
      console.log('[InterventionForm useEffect] Mode création - lotIdIntervention défini à:', currentLotId ? String(currentLotId) : '');
      setIsDeletingConfirmation(false);
    } else if (interventionData) {
      setNomIntervention(interventionData.nom || '');
      setDateIntervention(interventionData.date || '');
      setDateFinIntervention(interventionData.date_fin || interventionData.date || '');
      setHeureDebutIntervention(interventionData.heure_debut || '');
      setHeureFinIntervention(interventionData.heure_fin || '');
      setLotIdIntervention(interventionData.lot_id ? String(interventionData.lot_id) : '');
      console.log('[InterventionForm useEffect] Mode édition - lotIdIntervention défini à:', interventionData.lot_id ? String(interventionData.lot_id) : '');
      setIsDeletingConfirmation(false);
    }
    // Pas besoin de 'else' pour réinitialiser ici, car le composant sera
    // démonté lorsque interventionFormState dans le parent devient null,
    // ce qui réinitialise naturellement son état lors du prochain montage.
  }, [interventionData, isCreating, currentLotId, allLots]); // Ajout de allLots aux dépendances si sa structure peut changer et affecter le rendu

  const handleSave = async () => {
    setIsSaving(true);
    const payload = {
      nom: nomIntervention.trim() || null,
      date: dateIntervention,
      heure_debut: heureDebutIntervention,
      heure_fin: heureFinIntervention,
      date_fin: dateFinIntervention || dateIntervention,
      lot_id: lotIdIntervention ? parseInt(lotIdIntervention, 10) : null
    };

    const { error } = isCreating
      ? await supabase.from('interventions').insert([payload])
      : await supabase
          .from('interventions')
          .update(payload)
          .eq('id', interventionData.id);

    if (!error) {
      // L'alerte peut être gérée par le composant parent ou globalement si préféré
      // alert(isCreating ? 'Intervention créée avec succès !' : 'Intervention mise à jour avec succès !');
      onSaveSuccess?.();
      // onClose(); // onClose est maintenant appelé par handleInterventionFormSuccess dans le parent
    } else {
      alert(`Erreur : ${error.message}`);
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!interventionData || !interventionData.id) {
      alert("Aucune intervention sélectionnée pour la suppression.");
      return;
    }
    setIsSaving(true);
    const { error } = await supabase
      .from('interventions')
      .delete()
      .eq('id', interventionData.id);

    if (!error) {
      // alert('Intervention supprimée avec succès !');
      onDeleteSuccess?.();
      // onClose(); // onClose est maintenant appelé par handleInterventionFormSuccess dans le parent
    } else {
      alert(`Erreur lors de la suppression : ${error.message}`);
    }
    setIsSaving(false);
    setIsDeletingConfirmation(false);
  };

  const isLotSelectDisabled = isSaving || (isCreating && !!currentLotId);
  console.log('[InterventionForm render] lotIdIntervention:', lotIdIntervention, 'isLotSelectDisabled:', isLotSelectDisabled);

  return (
    <div style={{ border: '1px solid #ddd', padding: '15px', margin: '10px 0', backgroundColor: '#fdfdfd', borderRadius: '4px' }}>
      <h3 style={{ marginTop: 0, marginBottom: '15px' }}>{isCreating ? 'Nouvelle Intervention' : 'Modifier l\'Intervention'}</h3>
      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="intervention-nom" style={{ display: 'block', marginBottom: '5px' }}>Nom (optionnel) :</label>
          <input type="text" id="intervention-nom" value={nomIntervention} onChange={(e) => setNomIntervention(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} disabled={isSaving} />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="intervention-lot" style={{ display: 'block', marginBottom: '5px' }}>Lot associé :</label>
          <select
            id="intervention-lot"
            value={lotIdIntervention}
            onChange={(e) => setLotIdIntervention(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            disabled={isLotSelectDisabled} 
          >
            <option value="">-- Sélectionner un lot --</option>
            {(allLots || []).map((lot) => (
              <option key={lot.id} value={String(lot.id)}>
                {lot.nom} {lot.projectName && `(${lot.projectName})`}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="intervention-date-debut" style={{ display: 'block', marginBottom: '5px' }}>Date de début :</label>
            <input type="date" id="intervention-date-debut" value={dateIntervention} onChange={(e) => setDateIntervention(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} disabled={isSaving} />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="intervention-heure-debut" style={{ display: 'block', marginBottom: '5px' }}>Heure de début :</label>
            <input type="time" id="intervention-heure-debut" value={heureDebutIntervention} onChange={(e) => setHeureDebutIntervention(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} disabled={isSaving} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="intervention-date-fin" style={{ display: 'block', marginBottom: '5px' }}>Date de fin :</label>
            <input type="date" id="intervention-date-fin" value={dateFinIntervention} onChange={(e) => setDateFinIntervention(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} disabled={isSaving} />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="intervention-heure-fin" style={{ display: 'block', marginBottom: '5px' }}>Heure de fin :</label>
            <input type="time" id="intervention-heure-fin" value={heureFinIntervention} onChange={(e) => setHeureFinIntervention(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} disabled={isSaving} />
          </div>
        </div>

        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <button type="submit" style={{ padding: '8px 15px', marginRight: '10px' }} disabled={isSaving || !lotIdIntervention}>
              {isSaving ? (isCreating ? 'Création...' : 'Enregistrement...') : (isCreating ? 'Créer' : 'Enregistrer')}
            </button>
            {!isCreating && (
              <>
                {!isDeletingConfirmation ? (
                  <button
                    type="button"
                    onClick={() => setIsDeletingConfirmation(true)}
                    style={{ padding: '8px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}
                    disabled={isSaving}
                  >
                    Supprimer
                  </button>
                ) : (
                  <div style={{ display: 'inline-flex', gap: '10px', alignItems: 'center' }}>
                    <span>Confirmer ?</span>
                    <button
                      type="button"
                      onClick={handleDelete}
                      style={{ padding: '8px 10px', backgroundColor: '#c82333', color: 'white', border: 'none', borderRadius: '4px' }}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Suppression...' : 'Oui'}
                    </button>
                    <button type="button" onClick={() => setIsDeletingConfirmation(false)} style={{ padding: '8px 10px' }} disabled={isSaving}>
                      Non
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
          <button type="button" onClick={onClose} style={{ padding: '8px 15px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px' }} disabled={isSaving}>
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
};

export default InterventionForm;
