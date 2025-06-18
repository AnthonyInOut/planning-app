// src/InterventionForm.jsx
import { useState, useEffect, useCallback } from 'react'; // Ajout de useCallback
import moment from 'moment'; // Importer moment pour les dates par défaut
import DatePicker, { registerLocale } from 'react-datepicker'; // Importer react-datepicker
import { fr } from 'date-fns/locale'; // Importer la locale française pour date-fns
registerLocale('fr', fr); // Enregistrer la locale française pour react-datepicker
import 'react-datepicker/dist/react-datepicker.css'; // Importer les styles CSS
import { INTERVENTION_ETATS, ETAT_CATEGORIES, ETATS_PAR_CATEGORIE } from './utils/interventionStates'; // Importer les états
import { supabase } from './lib/supabaseClient';

const InterventionForm = ({
  onClose,
  interventionData,
  isCreating,
  allLots,
  currentLotId, // ID du lot pour la création
  onSaveSuccess,
  onDeleteSuccess,
  allInterventions = [], // Prop ajoutée avec valeur par défaut
  allProjets = [],       // Prop ajoutée avec valeur par défaut
  entreprisesList = []   // Prop ajoutée avec valeur par défaut
}) => {
  const [nomIntervention, setNomIntervention] = useState('');
  const [dateIntervention, setDateIntervention] = useState('');
  const [dateFinIntervention, setDateFinIntervention] = useState('');
  const [heureDebutIntervention, setHeureDebutIntervention] = useState('');
  const [heureFinIntervention, setHeureFinIntervention] = useState('');
  const [lotIdIntervention, setLotIdIntervention] = useState('');
  const [etatIntervention, setEtatIntervention] = useState(''); // Nouvel état pour l'état de l'intervention
  const [visibleSurPlanning, setVisibleSurPlanning] = useState(true); // Nouvel état pour la visibilité
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingConfirmation, setIsDeletingConfirmation] = useState(false);
  const [companyConflictWarning, setCompanyConflictWarning] = useState('');

  // Définir les états actifs pour la planification
  const ACTIVE_PLANNING_ETATS = [
    INTERVENTION_ETATS.PREVISION_INTERVENTION,
    INTERVENTION_ETATS.INTERVENTION_VALIDEE_ARTISAN,
    INTERVENTION_ETATS.OK_MATERIAUX,
  ];

  // Fonction pour filtrer les week-ends dans react-datepicker
  const isWeekday = (date) => {
    const day = moment(date).day();
    return day !== 0 && day !== 6; // 0 = Dimanche, 6 = Samedi
  };

  // Fonction pour ajouter une classe CSS aux week-ends
  const weekendDayClassName = (date) => {
    const day = moment(date).day();
    const className = (day === 0 || day === 6) ? 'react-datepicker__day--weekend-hidden' : undefined;
    console.log(`[weekendDayClassName] Date: ${moment(date).format('YYYY-MM-DD')}, Day: ${day}, Class: ${className}`); // Assurez-vous que cette ligne est décommentée
    return className;
  };
  // console.log('[InterventionForm] Props reçues:', { interventionData, isCreating, allLots, currentLotId });

  const checkCompanyConflict = useCallback(() => {
    // Si l'intervention en cours n'est pas dans un état de planification active, ne pas vérifier les conflits.
    // etatIntervention est l'état actuel du formulaire.
    if (!ACTIVE_PLANNING_ETATS.includes(etatIntervention) || !lotIdIntervention || !dateIntervention || !dateFinIntervention) {
      // console.log('[checkCompanyConflict] Données de base manquantes (lotId, dateDebut, dateFin).');
      return '';
    }
    // Utiliser directement allLots et allProjets (qui sont censés être non filtrés)
    if (!allLots || !allInterventions || !allProjets || !entreprisesList) {
      console.warn('[checkCompanyConflict] Une ou plusieurs listes de données globales (allLots, allInterventions, allProjets, entreprisesList) ne sont pas disponibles.');
      return '';
    }

    // console.log('[checkCompanyConflict] Vérification pour:', { dateIntervention, dateFinIntervention, lotIdIntervention });

    const currentInterventionStart = moment(dateIntervention);
    const currentInterventionEnd = moment(dateFinIntervention);
    if (!currentInterventionStart.isValid() || !currentInterventionEnd.isValid()) {
      // console.log('[checkCompanyConflict] Dates invalides pour l\'intervention en cours.');
      return '';
    }

    const selectedLot = allLots.find(l => l.id.toString() === lotIdIntervention.toString());
    // console.log('[checkCompanyConflict] Lot sélectionné:', selectedLot);
    if (!selectedLot || !selectedLot.entreprise_id) { // Vérifie entreprise_id directement sur le lot
      // console.log('[checkCompanyConflict] Lot non trouvé ou entreprise_id manquant sur le lot sélectionné.');
      return '';
    }

    const currentEntrepriseId = selectedLot.entreprise_id;
    const currentEntreprise = entreprisesList.find(e => e.id === currentEntrepriseId);
    const currentEntrepriseName = currentEntreprise ? currentEntreprise.nom : `ID Entreprise ${currentEntrepriseId}`;
    // console.log(`[checkCompanyConflict] Entreprise actuelle: ${currentEntrepriseName} (ID: ${currentEntrepriseId})`);
    const conflictingInterventionsInfo = [];

    for (const otherIntervention of allInterventions) {
      if (interventionData && otherIntervention.id === interventionData.id) continue;

      // Vérifier si l'autre intervention est dans un état de planification active
      if (!ACTIVE_PLANNING_ETATS.includes(otherIntervention.etat)) continue;

      const otherLot = allLots.find(l => l.id === otherIntervention.lot_id);
      // Ne signaler un conflit que si l'entreprise est la même ET les projets sont différents
      if (!otherLot || otherLot.entreprise_id !== currentEntrepriseId || selectedLot.projet_id === otherLot.projet_id) continue;

      const otherStart = moment(otherIntervention.date);
      const otherEnd = moment(otherIntervention.date_fin || otherIntervention.date);
      if (!otherStart.isValid() || !otherEnd.isValid()) continue;

      const datesOverlap = currentInterventionStart.isSameOrBefore(otherEnd) && currentInterventionEnd.isSameOrAfter(otherStart);
      // console.log(`[checkCompanyConflict] Comparaison avec intervention ID ${otherIntervention.id} (Lot: ${otherLot.nom}, Entreprise ID: ${otherLot.entreprise_id}). Chevauchement: ${datesOverlap}`);

      if (datesOverlap) {
        const projetOfOtherLot = allProjets.find(p => p.id === otherLot.projet_id);
        conflictingInterventionsInfo.push(
          `"${otherIntervention.nom || 'Intervention'}" sur le chantier "${projetOfOtherLot ? projetOfOtherLot.nom : 'N/A'}" (Lot: ${otherLot.nom}) du ${otherStart.format('DD/MM')} au ${otherEnd.format('DD/MM')}`
        );
      }
    }
    if (conflictingInterventionsInfo.length > 0) {
      const warningMsg = `Attention : L'entreprise "${currentEntrepriseName}" est déjà planifiée sur :\n- ${conflictingInterventionsInfo.join('\n- ')}\npendant cette période.`;
      // console.log('[checkCompanyConflict] Conflit détecté:', warningMsg);
      return warningMsg;
    }
    // console.log('[checkCompanyConflict] Aucun conflit détecté.');
    return '';
  }, [dateIntervention, dateFinIntervention, lotIdIntervention, etatIntervention, interventionData, allInterventions, allLots, allProjets, entreprisesList, ACTIVE_PLANNING_ETATS]);

  useEffect(() => {
    // console.log('[InterventionForm useEffect] Début - Props:', { interventionData, isCreating, currentLotId });
    // Log pour voir la liste des lots disponibles au moment de l'effet
    // if (allLots && allLots.length > 0) {
      // console.log('[InterventionForm useEffect] allLots:', allLots);
    // } else {
      // console.warn('[InterventionForm useEffect] allLots est vide ou non défini.');
    // }
    if (isCreating) {
      // Si interventionData est null (création à partir de zéro) ou n'a pas de date, utiliser des valeurs par défaut.
      const defaultDate = moment().format('YYYY-MM-DD');
      setNomIntervention(interventionData?.nom || '');
      setDateIntervention(interventionData?.date || defaultDate);
      setDateFinIntervention(interventionData?.date_fin || interventionData?.date || defaultDate);
      setHeureDebutIntervention(interventionData?.heure_debut || '08:00');
      setHeureFinIntervention(interventionData?.heure_fin || '17:00');
      setLotIdIntervention(currentLotId ? String(currentLotId) : '');
      setEtatIntervention(INTERVENTION_ETATS.DEMANDE_DEVIS); // État par défaut pour la création
      setVisibleSurPlanning(true); // Par défaut visible à la création
      // console.log('[InterventionForm useEffect] Mode création - lotIdIntervention défini à:', currentLotId ? String(currentLotId) : '');
      setIsDeletingConfirmation(false);
    } else if (interventionData) {
      setNomIntervention(interventionData.nom || '');
      setDateIntervention(interventionData.date || '');
      setDateFinIntervention(interventionData.date_fin || interventionData.date || '');
      setHeureDebutIntervention(interventionData.heure_debut || '');
      setHeureFinIntervention(interventionData.heure_fin || '');
      setLotIdIntervention(interventionData.lot_id ? String(interventionData.lot_id) : '');
      setEtatIntervention(interventionData.etat || INTERVENTION_ETATS.DEMANDE_DEVIS); // Charger l'état existant ou un défaut
      setVisibleSurPlanning(interventionData.visible_sur_planning !== undefined ? interventionData.visible_sur_planning : true);
      // console.log('[InterventionForm useEffect] Mode édition - lotIdIntervention défini à:', interventionData.lot_id ? String(interventionData.lot_id) : '');
      setIsDeletingConfirmation(false);
    }
    // Pas besoin de 'else' pour réinitialiser ici, car le composant sera
    // démonté lorsque interventionFormState dans le parent devient null,
    // ce qui réinitialise naturellement son état lors du prochain montage.
  }, [interventionData, isCreating, currentLotId, allLots]); // Ajout de allLots aux dépendances si sa structure peut changer et affecter le rendu

  useEffect(() => {
    const warning = checkCompanyConflict();
    setCompanyConflictWarning(warning);
  }, [checkCompanyConflict]); // Se redéclenche si les dépendances de checkCompanyConflict changent

  const handleSave = async () => {
    setIsSaving(true);
    const payload = {
      nom: nomIntervention.trim() || null,
      date: dateIntervention,
      heure_debut: heureDebutIntervention,
      heure_fin: heureFinIntervention,
      date_fin: dateFinIntervention || dateIntervention,
      lot_id: lotIdIntervention ? parseInt(lotIdIntervention, 10) : null,
      etat: etatIntervention, // Ajouter l'état au payload
      visible_sur_planning: visibleSurPlanning // Ajouter la visibilité au payload
    };

    // Validation des dates pour les week-ends
    // const startDateMoment = moment(payload.date); // La validation est maintenant gérée par le filterDate du DatePicker
    // if (startDateMoment.day() === 0 || startDateMoment.day() === 6) { 
    //   alert("La date de début ne peut pas être un samedi ou un dimanche.");
    //   setIsSaving(false);
    //   return;
    // }

    // if (payload.date_fin) {
    //   const endDateMoment = moment(payload.date_fin);
    //   if (endDateMoment.day() === 0 || endDateMoment.day() === 6) {
    //     alert("La date de fin ne peut pas être un samedi ou un dimanche.");
    //     setIsSaving(false);
    //     return;
    //   }
    //   if (endDateMoment.isBefore(startDateMoment)) { // Cette validation reste utile
    //     alert("La date de fin ne peut pas être antérieure à la date de début.");
    //     setIsSaving(false);
    //     return;
    //   }
    // }

    if (companyConflictWarning) {
      if (!window.confirm(`${companyConflictWarning}\n\nVoulez-vous continuer quand même ?`)) {
        setIsSaving(false);
        // console.log('[InterventionForm handleSave] Sauvegarde annulée par l\'utilisateur à cause d\'un conflit.');
        return;
      }
    }

    const { error } = isCreating
      ? await supabase.from('interventions').insert([payload])
      : await supabase
          .from('interventions')
          .update(payload)
          .eq('id', interventionData.id);

    if (!error) {
      // console.log('[InterventionForm handleSave] Sauvegarde réussie.');
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
  // console.log('[InterventionForm render] lotIdIntervention:', lotIdIntervention, 'isLotSelectDisabled:', isLotSelectDisabled);

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

        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="intervention-etat" style={{ display: 'block', marginBottom: '5px' }}>État :</label>
          <select
            id="intervention-etat"
            value={etatIntervention}
            onChange={(e) => setEtatIntervention(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            disabled={isSaving}
          >
            {Object.values(ETAT_CATEGORIES).map(category => (
              <optgroup label={category} key={category}>
                {ETATS_PAR_CATEGORIE[category].map(etatValue => (
                  <option key={etatValue} value={etatValue}>{etatValue}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="intervention-visible" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              id="intervention-visible"
              checked={visibleSurPlanning}
              onChange={(e) => setVisibleSurPlanning(e.target.checked)}
              style={{ marginRight: '8px' }}
              disabled={isSaving}
            />
            Visible sur le planning
          </label>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="intervention-date-debut" style={{ display: 'block', marginBottom: '5px' }}>Date de début :</label>
            <DatePicker
              id="intervention-date-debut"
              selected={dateIntervention ? moment(dateIntervention).toDate() : null}
              onChange={(date) => setDateIntervention(date ? moment(date).format('YYYY-MM-DD') : '')}
              dateFormat="dd/MM/yyyy"
              locale="fr" // Spécifier la locale à utiliser
              filterDate={isWeekday}
              dayClassName={weekendDayClassName}
              placeholderText="JJ/MM/AAAA"
              required
              className="date-picker-full-width" // Ajoutez une classe pour styler si besoin
              disabled={isSaving}
              popperPlacement="bottom-start"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="intervention-heure-debut" style={{ display: 'block', marginBottom: '5px' }}>Heure de début :</label>
            <input type="time" id="intervention-heure-debut" value={heureDebutIntervention} onChange={(e) => setHeureDebutIntervention(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} disabled={isSaving} /> {/* Le style peut être ajusté via CSS */}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="intervention-date-fin" style={{ display: 'block', marginBottom: '5px' }}>Date de fin :</label>
            <DatePicker
              id="intervention-date-fin"
              selected={dateFinIntervention ? moment(dateFinIntervention).toDate() : null}
              onChange={(date) => setDateFinIntervention(date ? moment(date).format('YYYY-MM-DD') : '')}
              dateFormat="dd/MM/yyyy"
              locale="fr" // Spécifier la locale à utiliser
              filterDate={isWeekday}
              dayClassName={weekendDayClassName}
              placeholderText="JJ/MM/AAAA"
              minDate={dateIntervention ? moment(dateIntervention).toDate() : null} // Empêche de sélectionner une date de fin avant la date de début
              required={!!dateFinIntervention} // Requis seulement si une date de fin est entrée (ou toujours requis selon votre logique)
              className="date-picker-full-width"
              disabled={isSaving}
              popperPlacement="bottom-start"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="intervention-heure-fin" style={{ display: 'block', marginBottom: '5px' }}>Heure de fin :</label>
            <input type="time" id="intervention-heure-fin" value={heureFinIntervention} onChange={(e) => setHeureFinIntervention(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} disabled={isSaving} />
          </div>
        </div>

        {companyConflictWarning && (
          <div style={{ color: 'orange', marginTop: '10px', padding: '10px', border: '1px solid orange', borderRadius: '4px', whiteSpace: 'pre-wrap' }}>
            {companyConflictWarning}
          </div>
        )}

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
