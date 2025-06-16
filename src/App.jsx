// src/App.jsx
/** @jsxImportSource react */
import { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'; // Modifié pour utiliser le fork maintenu
import { supabase } from './lib/supabaseClient';
import CreateProjet from './CreateProjet';
import CreateUser from './CreateUser'; // Importer le nouveau composant CreateUser
import CreateLot from './CreateLot';
import ListeLots from './ListeLots';
import GestionInterventions from './GestionInterventions';
import CalendrierInterventions from './CalendrierInterventions';
import ThreeMonthGrid from './ThreeMonthGrid';
import Modal from './Modal'; // Importer le composant Modal
import EditProjet from './EditProjet'; // Importer le nouveau composant EditProjet
import EditLot from './EditLot'; // Importer le nouveau composant EditLot
import moment from 'moment';
// Locale setting moved to main.jsx
import { shadeColor, findAvailableShade } from './utils/colorUtils'; // Importer findAvailableShade
import { getSpecialDaysDataForRange } from './utils/holidays'; // Assurez-vous que ce chemin est correct
import { INTERVENTION_ETATS, ETAT_STYLES, ETAT_CATEGORIES, ETATS_PAR_CATEGORIE, getHachuresStyle } from './utils/interventionStates'; // Importer les états et la fonction pour les hachures

function App() {
  const [projets, setProjets] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [selectedIntervention, setSelectedIntervention] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [refreshFlag, setRefreshFlag] = useState(false);
  const [refreshCalendar, setRefreshCalendar] = useState(false);
  const [viewMode, setViewMode] = useState('3months'); // Les valeurs seront '3months', '6months', '12months'

  const [isCreateProjetModalOpen, setIsCreateProjetModalOpen] = useState(false);
  const [isCreateLotModalOpen, setIsCreateLotModalOpen] = useState(false);
  const [currentProjetIdForLot, setCurrentProjetIdForLot] = useState(null);
  const [isGestionInterventionModalOpen, setIsGestionInterventionModalOpen] = useState(false);
  const [optimisticallyDeletedLinkIds, setOptimisticallyDeletedLinkIds] = useState(new Set());
  const [currentLotIdForIntervention, setCurrentLotIdForIntervention] = useState(null);

  const [links, setLinks] = useState([]);
  const [isEditProjetModalOpen, setIsEditProjetModalOpen] = useState(false);
  const [currentProjetToEdit, setCurrentProjetToEdit] = useState(null);
  const [isEditLotModalOpen, setIsEditLotModalOpen] = useState(false);
  const [currentLotToEdit, setCurrentLotToEdit] = useState(null);

  const [expandedProjets, setExpandedProjets] = useState({});
  const [projectLotsExpandedInGrid, setProjectLotsExpandedInGrid] = useState({});
  const [expandedLotInterventionsInGrid, setExpandedLotInterventionsInGrid] = useState({});

  const [specialDaysData, setSpecialDaysData] = useState({ publicHolidays: [], schoolVacations: [] });
  const [isLoadingSpecialDays, setIsLoadingSpecialDays] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true); // Nouvel état de chargement global

  // États pour la gestion multi-utilisateurs
  const [usersList, setUsersList] = useState([]);
  const [currentUser, setCurrentUser] = useState(null); // Stockera l'objet utilisateur complet
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [showLegend, setShowLegend] = useState(false); // État pour la légende
  const [showCurrentDayIndicator, setShowCurrentDayIndicator] = useState(true); // Nouvel état pour l'indicateur du jour actuel

  // État pour la date de début de la vue de la grille (pour ThreeMonthGrid)
  const [currentGridStartDate, setCurrentGridStartDate] = useState(moment().startOf('month'));

  const fetchUsers = async () => {
    const { data, error } = await supabase.from('users').select('*');
    if (error) {
      console.error("Erreur lors de la récupération des utilisateurs:", error);
    } else {
      setUsersList(data || []);
    }
  };

  const fetchProjets = async () => {
    let query = supabase
      .from('projets')
      .select('id, nom, color, user_id, lots(id, nom, projet_id, color, display_order, entreprise_id)') // <-- Ajout de user_id ici
      .order('id', { ascending: true })
      .order('display_order', { foreignTable: 'lots', ascending: true });

    if (currentUser && !showAllProjects) {
      query = query.eq('user_id', currentUser.id);
    }
    // Si !currentUser et !showAllProjects, on pourrait choisir de ne rien afficher ou tous par défaut.
    // Si showAllProjects est true, aucune condition user_id n'est ajoutée, donc tous les projets sont récupérés.

    const { data, error } = await query;

    if (!error) {
      setProjets(data);
    } else {
      console.error("Erreur lors de la récupération des projets :", error);
    }
  };

  const fetchLinks = async (optimisticAction = null) => {
    console.log("[App.jsx] fetchLinks - DÉBUT", "Action optimiste:", optimisticAction); // Log de début

    // Step 1: Apply optimistic action to ODL state immediately (scheduled by React)
    setOptimisticallyDeletedLinkIds(prevODL => {
        const newODL = new Set(prevODL);
        if (optimisticAction) {
            if (optimisticAction.type === 'delete' && optimisticAction.id) {
                newODL.add(optimisticAction.id);
                console.log(`[App.jsx] Optimistic 'delete': ID ${optimisticAction.id} added to ODL (scheduled). ODL size: ${newODL.size}`);
            } else if (optimisticAction.type === 'add' && optimisticAction.id) {
                newODL.delete(optimisticAction.id);
                console.log(`[App.jsx] Optimistic 'add': ID ${optimisticAction.id} removed from ODL (scheduled). ODL size: ${newODL.size}`);
            } else if (optimisticAction.type === 'conflict_resolved' && optimisticAction.id) {
                newODL.delete(optimisticAction.id);
                console.log(`[App.jsx] Optimistic 'conflict_resolved': ID ${optimisticAction.id} removed from ODL (scheduled). ODL size: ${newODL.size}`);
            }
        }
        console.log("[App.jsx] fetchLinks - ODL state AFTER optimistic update (inside setState, scheduled):", newODL);
        return newODL; // This is the state React will use for the next render cycle
    });

    // Step 2: Apply optimistic action to links state immediately (scheduled by React)
    // This provides immediate UI feedback for delete/add.
    if (optimisticAction) {
        if (optimisticAction.type === 'delete' && optimisticAction.id) {
            setLinks(prevLinks => prevLinks.filter(link => link.id !== optimisticAction.id));
            console.log(`[App.jsx] Optimistic 'delete': Links UI updated (scheduled).`);
        } else if (optimisticAction.type === 'add' && optimisticAction.id && optimisticAction.newLink) {
            setLinks(prevLinks => {
                if (prevLinks.some(link => link.id === optimisticAction.newLink.id)) return prevLinks;
                return [...prevLinks, optimisticAction.newLink];
            });
            console.log(`[App.jsx] Optimistic 'add': Links UI updated (scheduled).`);
        }
        // No setLinks update for 'conflict_resolved' here, the fetch will handle it.
    }


    // Step 3: Fetch fresh data from Supabase
    const { data, error } = await supabase
        .from('links')
        .select('*');

    console.log('[App.jsx] fetchLinks - Données de Supabase (après fetch):', data, 'Erreur:', error);

    if (!error) {
        const freshLinks = data || [];

        // Step 4 & 5: Reconcile ODL and filter links state *within the same setState callback*
        // This ensures we use the ODL state that reflects the optimistic update AND reconciliation.
        setOptimisticallyDeletedLinkIds(prevODL_afterOptimistic => {
            // prevODL_afterOptimistic should be the state *after* the optimistic update in Step 1.
            let reconciledODL = new Set(prevODL_afterOptimistic);
            let idsRemovedFromODL = new Set();

            // Create a Set of IDs from freshLinks for efficient lookup (ensure IDs are strings)
            const idsInFreshLinks = new Set(freshLinks.map(link => String(link.id)));
            console.log("[App.jsx] fetchLinks - IDs in freshLinks:", Array.from(idsInFreshLinks));

            // Reconcile ODL: Remove IDs from ODL if they are *NOT* present in freshLinks
            // This means BDD confirms deletion, so they are no longer "optimistically deleted"
            prevODL_afterOptimistic.forEach(deletedId => { // Iterate over the state *after* optimistic update
                // Check if the ID was in ODL but is NOT in freshLinks.
                // If so, BDD confirmed deletion. Remove it from ODL.
                if (!idsInFreshLinks.has(String(deletedId))) { // Ensure comparison with string ID
                    reconciledODL.delete(deletedId);
                    idsRemovedFromODL.add(deletedId);
                    console.warn(`[App.jsx] Réconciliation état ODL: Lien ID ${deletedId} retiré de optimisticallyDeletedLinkIds car ABSENT du fetch Supabase (suppression confirmée).`);
                }
            });

            // --- Filtering Step ---
            // Filter freshLinks using the *reconciled* ODL set.
            let finalLinksToDisplay = freshLinks;
            if (reconciledODL.size > 0) {
                const initialCount = finalLinksToDisplay.length;
                // Ensure link.id is a string for comparison with Set keys.
                finalLinksToDisplay = finalLinksToDisplay.filter(link => !reconciledODL.has(String(link.id)));
                console.warn(`[App.jsx] Fresh links filtered by ${reconciledODL.size} ODL IDs (after reconciliation). Before: ${initialCount}, After: ${finalLinksToDisplay.length}. Filtered IDs: ${Array.from(reconciledODL).join(', ')}`);
            }

            // Update the displayed links state with the filtered list
            // This setLinks call will be batched with the setOptimisticallyDeletedLinkIds call.
            setLinks(finalLinksToDisplay);
            console.log('[App.jsx] fetchLinks - Links state updated (inside reconciliation setState):', finalLinksToDisplay, `Nombre: ${finalLinksToDisplay.length}`);

            // Log changes to ODL
            if (idsRemovedFromODL.size > 0) {
                 console.log('[App.jsx] fetchLinks - IDs retirés de optimisticallyDeletedLinkIds (réconciliation):', Array.from(idsRemovedFromODL).join(', '));
            }
            console.log('[App.jsx] fetchLinks - État final optimisticallyDeletedLinkIds sera:', reconciledODL);

            return reconciledODL; // Return the new set to update the actual state
        });

    } else {
        console.error('Erreur fetch links:', error);
        // Handle fetch errors - maybe revert optimistic updates or show an error message
    }
};

  // Fonction consolidée pour récupérer interventions et liens
  const fetchAllData = async (optimisticLinkAction = null) => {
    console.log("[App.jsx] fetchAllData - DÉBUT", "Action optimiste pour liens:", optimisticLinkAction);
    setIsLoadingData(true);

    const interventionsPromise = supabase.from('interventions').select(`
      id, nom, lot_id, date, date_fin, heure_debut, heure_fin, etat, visible_sur_planning,
      lots (id, nom, projet_id, color)
    `);

    // Exécuter le fetch des interventions
    const { data: interventionsData, error: interventionsError } = await interventionsPromise;

    if (interventionsError) {
      console.error('Erreur fetch interventions:', interventionsError);
      setInterventions([]);
    } else {
      let fetchedInterventions = interventionsData || [];
      const today = moment().format('YYYY-MM-DD');
      const updatesToPerform = [];

      fetchedInterventions.forEach(intervention => {
        const styleInfo = ETAT_STYLES[intervention.etat];
        if (styleInfo && styleInfo.needsDateUpdate && intervention.etat !== INTERVENTION_ETATS.TERMINE) {
          const interventionDate = moment(intervention.date);
          if (interventionDate.isBefore(today, 'day')) {
            updatesToPerform.push(
              supabase.from('interventions').update({ 
                date: today, 
                date_fin: intervention.date_fin ? moment(today).add(moment(intervention.date_fin).diff(moment(intervention.date), 'days'), 'days').format('YYYY-MM-DD') : today 
              }).eq('id', intervention.id)
            );
            // Mettre à jour l'intervention localement pour un affichage immédiat
            intervention.date = today;
            intervention.date_fin = intervention.date_fin ? moment(today).add(moment(intervention.date_fin).diff(moment(intervention.date), 'days'), 'days').format('YYYY-MM-DD') : today;
          }
        }
      });

      if (updatesToPerform.length > 0) {
        console.log(`[App.jsx] Mise à jour de ${updatesToPerform.length} interventions "A ne pas oublier"...`);
        await Promise.all(updatesToPerform)
          .then(() => console.log("[App.jsx] Interventions 'A ne pas oublier' mises à jour avec succès."))
          .catch(err => console.error("[App.jsx] Erreur lors de la mise à jour des interventions 'A ne pas oublier':", err));
        // Les interventions sont déjà mises à jour dans fetchedInterventions pour l'UI
      }
      setInterventions(fetchedInterventions);
    }

    // Appeler fetchLinks pour qu'il gère sa propre logique (y compris le fetch Supabase et la réconciliation)
    await fetchLinks(optimisticLinkAction);

    setIsLoadingData(false);
    console.log("[App.jsx] fetchAllData - FIN");
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchUsers(); // Récupérer la liste des utilisateurs
    fetchProjets();
    fetchAllData(); // Appel initial pour interventions et liens

    // Restaurer l'utilisateur et la préférence d'affichage depuis localStorage
    const storedUserId = localStorage.getItem('currentUserId');
    const storedShowAll = localStorage.getItem('showAllProjects');

    if (storedShowAll !== null) {
      setShowAllProjects(JSON.parse(storedShowAll));
    }

    // Note: currentUser sera défini dans un autre useEffect après que usersList soit chargé
    // pour s'assurer que l'objet utilisateur complet est disponible.
  }, []); // Empty dependency array means this runs once on mount

  // Effet pour définir currentUser une fois que usersList est chargé et qu'un ID est stocké
  useEffect(() => {
    const storedUserId = localStorage.getItem('currentUserId');
    if (storedUserId && usersList.length > 0) {
      const user = usersList.find(u => u.id === storedUserId);
      if (user) setCurrentUser(user);
    }
  }, [usersList]); // Se déclenche quand usersList change

  useEffect(() => { // useEffect existant pour les jours spéciaux
    const fetchAllSpecialDays = async () => {
      setIsLoadingSpecialDays(true);
      const numMonthsForView = viewMode === '6months' ? 6 : viewMode === '12months' ? 12 : 3;
      const viewStartDate = moment(currentGridStartDate).startOf('month');
      const viewEndDate = moment(currentGridStartDate).add(numMonthsForView - 1, 'months').endOf('month');

      try {
        const data = await getSpecialDaysDataForRange(viewStartDate, viewEndDate);
        setSpecialDaysData(data);
      } catch (error) {
        console.error("Erreur lors de la récupération des données des jours spéciaux dans App.jsx:", error);
        setSpecialDaysData({ publicHolidays: [], schoolVacations: [] });
      } finally {
        setIsLoadingSpecialDays(false);
      }
    };
    fetchAllSpecialDays();
  }, [currentGridStartDate, viewMode]); // Ajout de viewMode comme dépendance

  // Effet pour mettre à jour les projets lorsque currentUser ou showAllProjects change
  useEffect(() => {
    fetchProjets();
    // Pas besoin de fetchAllData() ici sauf si les interventions/liens dépendent directement de l'utilisateur
    // ce qui n'est pas le cas actuellement.
  }, [currentUser, showAllProjects]);

  const handleUserChange = (userId) => {
    if (userId === "add_new_user") {
      setIsCreateUserModalOpen(true);
      // Garder la sélection actuelle du dropdown inchangée ou la réinitialiser
      // Pour l'instant, on ne change pas currentUser ou showAllProjects ici.
      return;
    }
    if (userId === "all") {
      setCurrentUser(null);
      setShowAllProjects(true);
      localStorage.setItem('currentUserId', '');
      localStorage.setItem('showAllProjects', JSON.stringify(true));
    } else {
      const user = usersList.find(u => u.id === userId);
      setCurrentUser(user);
      setShowAllProjects(false);
      localStorage.setItem('currentUserId', userId);
      localStorage.setItem('showAllProjects', JSON.stringify(false));
    }
  };

  const handleUserAdded = async (newUser) => {
    setIsCreateUserModalOpen(false);
    await fetchUsers(); // Rafraîchir la liste des utilisateurs
    if (newUser) { // Si un nouvel utilisateur a été retourné
      handleUserChange(newUser.id); // Sélectionner automatiquement le nouvel utilisateur
    }
  };

  const lots = useMemo(() => {
    return projets.reduce((acc, projet) => {
      if (projet.lots) {
        const lotsWithProjectContext = projet.lots.map(lot => ({
          ...lot,
          projetCouleur: projet.color || '#4a90e2',
          projectName: projet.nom,
        }));
        acc.push(...lotsWithProjectContext);
      }
      return acc;
    }, []);
  }, [projets]);

  const handleInterventionUpdatedByGrid = () => {
    fetchAllData(); // Refetch tout pour la cohérence
  };

  const handleOpenCreateProjetModal = () => setIsCreateProjetModalOpen(true);

  const handleOpenCreateLotModal = (projetId) => {
    // Vérifier si l'utilisateur a le droit de créer un lot pour ce projet (si currentUser est défini et !showAllProjects)
    const projet = projets.find(p => p.id === projetId);
    if (projet && (showAllProjects || (currentUser && projet.user_id === currentUser.id))) {
      setCurrentProjetIdForLot(projetId);
      setIsCreateLotModalOpen(true);
    } else {
      alert("Vous ne pouvez pas ajouter de lot à un projet qui ne vous appartient pas.");
    }
  };

  const handleOpenCreateInterventionModal = (lotId) => {
    setCurrentLotIdForIntervention(lotId);
    setSelectedIntervention(null);
    setIsCreating(true);
    setIsGestionInterventionModalOpen(true);
  };

  const handleEditIntervention = (interventionToEdit) => {
    setSelectedIntervention(interventionToEdit);
    setIsCreating(false);
    setCurrentLotIdForIntervention(null);
    setIsGestionInterventionModalOpen(true);
  };

  const handleAddInterventionFromGrid = (lotId, initialDate) => {
    setSelectedIntervention({
      date: initialDate || moment().format('YYYY-MM-DD'),
      date_fin: initialDate || moment().format('YYYY-MM-DD'),
      heure_debut: '08:00',
      heure_fin: '17:00',
    });
    setCurrentLotIdForIntervention(lotId);
    setIsCreating(true);
    setIsGestionInterventionModalOpen(true);
  };

  const handleCloseInterventionModal = () => {
    setIsGestionInterventionModalOpen(false);
    setSelectedIntervention(null);
    setIsCreating(false);
    setCurrentLotIdForIntervention(null);
    fetchAllData();
  };

  const handleOpenEditProjetModal = (projet) => {
    setCurrentProjetToEdit(projet);
    setIsEditProjetModalOpen(true);
  };

  const handleOpenEditLotModal = (lot) => {
    setCurrentLotToEdit(lot);
    setIsEditLotModalOpen(true);
  };

  const handleSaveProjet = () => {
    fetchProjets();
    setIsEditProjetModalOpen(false);
    setCurrentProjetToEdit(null);
  };

  const handleDeleteProjet = () => {
    fetchProjets();
    fetchAllData();
    setIsEditProjetModalOpen(false);
    setCurrentProjetToEdit(null);
  };

  const handleSaveLot = () => {
    fetchProjets();
    setIsEditLotModalOpen(false);
    setCurrentLotToEdit(null);
  };

  const handleDeleteLot = () => {
    fetchProjets();
    fetchAllData();
    setIsEditLotModalOpen(false);
    setCurrentLotToEdit(null);
  };

  const toggleProjetExpansion = (projetId) => {
    setExpandedProjets(prevExpanded => {
      const isNowExpanded = !prevExpanded[projetId];
      const targetProjet = projets.find(p => p.id === projetId);

      setProjectLotsExpandedInGrid(prevGridLotsExpanded => ({
        ...prevGridLotsExpanded,
        [projetId]: isNowExpanded
      }));

      if (targetProjet && targetProjet.lots) {
        setExpandedLotInterventionsInGrid(prevGridInterventionsExpanded => {
          const newGridInterventionsExpanded = { ...prevGridInterventionsExpanded };
          targetProjet.lots.forEach(lot => {
            newGridInterventionsExpanded[lot.id] = isNowExpanded;
          });
          return newGridInterventionsExpanded;
        });
      }

      return {
        ...prevExpanded,
        [projetId]: isNowExpanded
      };
    });
  };

  const toggleProjectLotsInGrid = (projetId) => {
    setProjectLotsExpandedInGrid(prevGridLotsExpanded => {
      const isNowVisible = !prevGridLotsExpanded[projetId];
      const targetProjet = projets.find(p => p.id === projetId);

      if (targetProjet && targetProjet.lots) {
        setExpandedLotInterventionsInGrid(prevGridInterventionsExpanded => {
          const newGridInterventionsExpanded = { ...prevGridInterventionsExpanded };
          targetProjet.lots.forEach(lot => {
            newGridInterventionsExpanded[lot.id] = isNowVisible;
          });
          return newGridInterventionsExpanded;
        });
      }
      return {
        ...prevGridLotsExpanded,
        [projetId]: isNowVisible
      };
    });
  };

  const toggleLotInterventionsInGrid = (lotId) => {
    setExpandedLotInterventionsInGrid(prevExpanded => ({
      ...prevExpanded,
      [lotId]: !prevExpanded[lotId]
    }));
  };

  const handlePreviousMonth = () => {
    setCurrentGridStartDate(prevDate => moment(prevDate).subtract(1, 'month').startOf('month'));
  };

  const handleNextMonth = () => {
    setCurrentGridStartDate(prevDate => moment(prevDate).add(1, 'month').startOf('month'));
  };

  const handleDragEndLots = async (result) => {
    console.log('[App.jsx] handleDragEndLots triggered with result:', result);
    const { source, destination } = result;

    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) {
      return;
    }

    const projetIdStr = source.droppableId.replace('droppable-projet-', '');
    const projetId = parseInt(projetIdStr, 10);

    const projetToUpdate = projets.find(p => p.id === projetId);
    if (!projetToUpdate || !projetToUpdate.lots) return;

    const reorderedLots = Array.from(projetToUpdate.lots);
    const [movedLot] = reorderedLots.splice(source.index, 1);
    reorderedLots.splice(destination.index, 0, movedLot);

    const updatedProjets = projets.map(p => {
      if (p.id === projetId) {
        return {
          ...p,
          lots: reorderedLots.map((lot, index) => ({ ...lot, display_order: index }))
        };
      }
      return p;
    });
    setProjets(updatedProjets);

    const updatesForSupabase = reorderedLots.map((lot, index) => ({
      id: lot.id,
      nom: lot.nom,
      projet_id: lot.projet_id,
      color: lot.color,
      entreprise_id: lot.entreprise_id || null,
      display_order: index
    }));

    const { error: updateError } = await supabase.from('lots').upsert(updatesForSupabase);

    if (updateError) {
      console.error("Erreur lors de la mise à jour de l'ordre des lots:", updateError);
      fetchProjets();
    }
  };

  const numberOfMonthsForGrid = useMemo(() => {
    if (viewMode === '6months') return 6;
    if (viewMode === '12months') return 12;
    return 3; // Par défaut pour '3months'
  }, [viewMode]);

  return (
    <div className="app-main-container" style={{ display: 'flex', height: '100vh' }}>
      <div className="print-hide" style={{
          width: '300px',
          minWidth: '300px',
          maxWidth: '300px',
          overflowY: 'auto',
          borderRight: '1px solid #ddd',
          textAlign: 'left',
          boxSizing: 'border-box',
          paddingLeft: '1rem',
          paddingRight: '1rem',
        }}>
        <h1 style={{
            margin: 0,
            fontSize: '1.5em',
            marginBottom: '1rem',
            paddingTop: '1rem'
          }}>Planning</h1>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="user-select" style={{ marginRight: '0.5rem', fontWeight: 'bold' }}>Utilisateur :</label>
          <select
            id="user-select"
            value={showAllProjects ? "all" : (currentUser?.id || "")}
            onChange={(e) => handleUserChange(e.target.value)}
            style={{ padding: '5px', minWidth: '150px' }}
          >
            <option value="" disabled>Choisir un utilisateur</option>
            {usersList.map(user => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
            <option value="all">Tous les projets</option>
            <option value="add_new_user" style={{ fontStyle: 'italic', color: 'blue' }}>+ Ajouter un utilisateur...</option>
          </select>
        </div>
        <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '1rem',
            cursor: 'pointer',
           }} onClick={handleOpenCreateProjetModal}>
          <span style={{ fontSize: '1.2em', marginRight: '8px', color: 'green' }}>+</span>
          <span style={{ fontWeight: 'bold' }}>Créer un projet</span>
        </div>

        <DragDropContext onDragEnd={handleDragEndLots}>
          {projets.map(projet => (
            <div key={projet.id} style={{
                marginBottom: '1rem',
                borderLeft: `3px solid ${projet.color || '#007bff'}`,
              }}>
              <div style={{ display: 'flex', alignItems: 'center', margin: '0.5rem 0' }}>
                <span
                  style={{
                    marginRight: '8px',
                    transform: expandedProjets[projet.id] ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                    display: 'inline-block',
                    cursor: 'pointer'
                  }}
                  onClick={() => toggleProjetExpansion(projet.id)}
                >
                  ▶
                </span>
                <h3
                  style={{ margin: 0, color: projet.color || '#007bff', cursor: 'pointer' }}
                  onClick={() => handleOpenEditProjetModal(projet)}
                >
                  {projet.nom}
                </h3>
              </div>

              {expandedProjets[projet.id] && (
                <Droppable
                  droppableId={`droppable-projet-${projet.id}`}
                  type="lot"
                  ignoreContainerClipping={false}
                  direction="vertical"
                  isCombineEnabled={false}
                  isDropDisabled={false}
                >
                  {(provided, snapshot) => {
                    if (snapshot.isDraggingOver) {
                      console.log(`[Droppable projet-${projet.id}] IS DRAGGING OVER. Snapshot:`, JSON.parse(JSON.stringify(snapshot)));
                      if (provided.placeholder) {
                        console.log(`[Droppable projet-${projet.id}] Placeholder element:`, provided.placeholder);
                      }
                    }
                    return (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        style={{
                          backgroundColor: snapshot.isDraggingOver ? '#ddeeff' : 'transparent',
                          border: snapshot.isDraggingOver ? '2px dashed #007bff' : '2px dashed transparent',
                          borderRadius: '4px',
                          minHeight: '40px',
                          width: '268px',
                          boxSizing: 'border-box',
                        }}
                      >
                        {(projet.lots && projet.lots.length > 0) ? projet.lots.map((lot, index) => (
                          <Draggable key={lot.id.toString()} draggableId={lot.id.toString()} index={index}>
                            {(providedDraggable, snapshotDraggable) => {
                              if (snapshotDraggable.isDragging) {
                                console.log(`[Draggable lot-${lot.id} IS DRAGGING] snapshotDraggable:`, JSON.parse(JSON.stringify(snapshotDraggable)));
                                console.log(`[Draggable lot-${lot.id} IS DRAGGING] providedDraggable.draggableProps.style:`, JSON.parse(JSON.stringify(providedDraggable.draggableProps.style)));
                              }

                              return (
                              <div
                                ref={providedDraggable.innerRef}
                                {...providedDraggable.draggableProps}
                                {...providedDraggable.dragHandleProps}
                                style={{
                                  marginBottom: '0.75rem',
                                  border: '1px solid #ddd',
                                  backgroundColor: snapshotDraggable.isDragging ? 'lightgoldenrodyellow' : '#f9f9f9',
                                  padding: '8px',
                                  display: 'block',
                                  boxSizing: 'border-box',
                                  width: '100%',
                                  ...providedDraggable.draggableProps.style,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => handleOpenEditLotModal(lot)}>
                                  <span style={{ fontSize: '0.9em', fontWeight: 'bold', color: lot.color || projet.color || '#333' }}>{lot.nom}</span>
                                  <button onClick={(e) => { e.stopPropagation(); handleOpenCreateInterventionModal(lot.id);}} style={{ background: 'none', border: 'thin solid grey', cursor: 'pointer', padding: '2px 5px' }}>+</button>
                                </div>
                                <ListeLots lotId={lot.id} interventions={interventions.filter(interv => interv.lot_id === lot.id)} onSelectIntervention={handleEditIntervention} />

                              </div>
                              );
                            }}
                          </Draggable>
                        )) : (
                          <p style={{ fontSize: '0.9em', fontStyle: 'italic', margin: '0.25rem 0 0.5rem 0' }}>Aucun lot pour ce projet.</p>
                        )}
                        {provided.placeholder}
                      </div>
                    );
                  }}
                </Droppable>
              )}
              {expandedProjets[projet.id] && (
                <div style={{ paddingLeft: '23px' }}>
                  <button
                    onClick={() => handleOpenCreateLotModal(projet.id)}
                    style={{ fontSize: '0.9em', color: '#007bff', border: 'none', background: 'none', padding: '5px 0', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <span style={{ fontSize: '1em', marginRight: '4px', color: 'green' }}>+</span> Ajouter un lot
                  </button>
                </div>
              )}
            </div>
          ))}
        </DragDropContext>
      </div>

      {isCreateProjetModalOpen && (
        <Modal isOpen={isCreateProjetModalOpen} onClose={() => setIsCreateProjetModalOpen(false)}>
          <h3 style={{ marginTop: 0 }}>Nouveau Projet</h3>
          <CreateProjet
            usersList={usersList} // Passer la liste des utilisateurs
            currentUser={currentUser} // Passer l'utilisateur courant
            onAjout={() => {
              fetchProjets(); // fetchProjets sera filtré par currentUser si applicable
              setIsCreateProjetModalOpen(false);
            }}
            onCancel={() => setIsCreateProjetModalOpen(false)}
          />
        </Modal>
      )}

      {isCreateLotModalOpen && currentProjetIdForLot && (
        <Modal isOpen={isCreateLotModalOpen} onClose={() => {
          setIsCreateLotModalOpen(false);
          setCurrentProjetIdForLot(null);
        }}>
          <h3 style={{ marginTop: 0 }}>Nouveau Lot pour : {projets.find(p => p.id === currentProjetIdForLot)?.nom || `Projet ID ${currentProjetIdForLot}`}</h3>
          <CreateLot
            parentProjet={projets.find(p => p.id === currentProjetIdForLot)}
            siblingLots={(projets.find(p => p.id === currentProjetIdForLot)?.lots || [])}
            projetId={currentProjetIdForLot}
            userId={currentUser?.id} // Passer l'ID de l'utilisateur pour l'assignation
            projets={projets}
            onAjout={() => {
              fetchProjets();
              setIsCreateLotModalOpen(false);
              setCurrentProjetIdForLot(null);
            }}
            onCancel={() => {
              setIsCreateLotModalOpen(false);
              setCurrentProjetIdForLot(null);
            }}
          />
        </Modal>
      )}

      {isGestionInterventionModalOpen && (
        <Modal isOpen={isGestionInterventionModalOpen} onClose={handleCloseInterventionModal}>
          <h3 style={{ marginTop: 0 }}>
            {isCreating ? `Nouvelle Intervention ${currentLotIdForIntervention ? `pour Lot ${lots.find(l => l.id === currentLotIdForIntervention)?.nom || `ID ${currentLotIdForIntervention}`}` : ''}` : `Modifier l'Intervention ${selectedIntervention?.nom || ''}`}
          </h3>
          <GestionInterventions
            lots={lots}
            selectedIntervention={selectedIntervention}
            isCreating={isCreating}
            onRefreshCalendar={() => { fetchAllData(); handleCloseInterventionModal(); }} // Utiliser fetchAllData
            onCloseForm={handleCloseInterventionModal}
            initialLotId={isCreating ? currentLotIdForIntervention : selectedIntervention?.lot_id}
          />
        </Modal>
      )}

      {isEditProjetModalOpen && currentProjetToEdit && (
        <Modal
          isOpen={isEditProjetModalOpen}
          onClose={() => {
            setIsEditProjetModalOpen(false);
            setCurrentProjetToEdit(null);
          }}
        >
          <EditProjet
            projet={currentProjetToEdit}
            usersList={usersList} // Passer la liste des utilisateurs
            onSave={handleSaveProjet}
            onDelete={handleDeleteProjet}
            onClose={() => {
              setIsEditProjetModalOpen(false);
              setCurrentProjetToEdit(null);
            }} />
        </Modal>
      )}

      {isEditLotModalOpen && currentLotToEdit && (
        <Modal
          isOpen={isEditLotModalOpen}
          onClose={() => {
            setIsEditLotModalOpen(false);
            setCurrentLotToEdit(null);
          }}
        >
          <EditLot
            lot={currentLotToEdit}
            parentProjet={projets.find(p => p.id === currentLotToEdit?.projet_id)}
            siblingLots={(projets.find(p => p.id === currentLotToEdit?.projet_id)?.lots || []).filter(l => l.id !== currentLotToEdit?.id)}
            onSave={handleSaveLot}
            onDelete={handleDeleteLot}
            onClose={() => {
              setIsEditLotModalOpen(false);
              setCurrentLotToEdit(null);
            }} />
        </Modal>
      )}
      {isCreateUserModalOpen && (
        <Modal isOpen={isCreateUserModalOpen} onClose={() => setIsCreateUserModalOpen(false)}>
          <h3 style={{ marginTop: 0 }}>Nouvel Utilisateur</h3>
          <CreateUser onUserAdded={handleUserAdded} onCancel={() => setIsCreateUserModalOpen(false)} />
        </Modal>
      )}


      <div className="grid-print-container" style={{ width: '75%', padding: '1rem', overflow: 'auto' }}>
        <div className="print-hide"> {/* Cacher cette section lors de l'impression */}
          <h2>Vue calendrier</h2>

          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            style={{ marginBottom: '1rem' }}
          >
            <option value="3months">Vue 3 Mois</option>
            <option value="6months">Vue 6 Mois</option>
            <option value="12months">Vue 1 An</option>
          </select>
          <label style={{ marginLeft: '1rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={showLegend} onChange={() => setShowLegend(!showLegend)} />
            Afficher la légende
          </label>
          <label style={{ marginLeft: '1rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={showCurrentDayIndicator} onChange={() => setShowCurrentDayIndicator(!showCurrentDayIndicator)} />
            Afficher le jour actuel
          </label>
        </div>

        <ThreeMonthGrid
          interventions={interventions}
          links={links}
          projets={projets}
          expandedProjetsState={expandedProjets}
          projectLotsVisibilityState={projectLotsExpandedInGrid}
          onToggleProjectLotsVisibility={toggleProjectLotsInGrid}
          expandedLotInterventionsState={expandedLotInterventionsInGrid}
          onToggleLotInterventions={toggleLotInterventionsInGrid}
          onEditIntervention={handleEditIntervention}
          onAddIntervention={handleAddInterventionFromGrid}
          onInterventionUpdated={handleInterventionUpdatedByGrid}
          refetchLinks={fetchAllData} // Passer fetchAllData pour les liens
          onEditProjet={handleOpenEditProjetModal}
          onEditLot={handleOpenEditLotModal}
          specialDaysData={specialDaysData}
          isLoadingSpecialDays={isLoadingSpecialDays}
          currentStartDate={currentGridStartDate}
          onPreviousMonth={handlePreviousMonth}
          onNextMonth={handleNextMonth}
          isLoadingData={isLoadingData} // Passer l'état de chargement global
          showLegend={showLegend} // Passer l'état pour la légende
          interventionEtats={{ INTERVENTION_ETATS, ETAT_STYLES, ETAT_CATEGORIES, ETATS_PAR_CATEGORIE, getHachuresStyle }} // Passer les définitions d'états et la fonction pour les hachures
          showCurrentDayIndicator={showCurrentDayIndicator} // Passer le nouvel état
          numberOfMonthsToDisplay={numberOfMonthsForGrid} // Passer le nombre de mois calculé
        />
      </div>
    </div>
  );
}

export default App;
