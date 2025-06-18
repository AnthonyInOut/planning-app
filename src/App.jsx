// src/App.jsx
/** @jsxImportSource react */
import { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'; // Modifié pour utiliser le fork maintenu
import { supabase } from './lib/supabaseClient';
import CreateProjet from './CreateProjet';
import CreateUser from './CreateUser'; // Importer le nouveau composant CreateUser
import CreateLot from './CreateLot';
import ListeLots from './ListeLots';
import GestionInterventions from './GestionInterventions'; // Importer GestionInterventions
import ThreeMonthGrid from './ThreeMonthGrid';
import Modal from './Modal'; // Importer le composant Modal
import EditProjet from './EditProjet'; // Importer le nouveau composant EditProjet
import EditLot from './EditLot'; // Importer le nouveau composant EditLot
import GestionEntreprisesModal from './GestionEntreprisesModal'; // Importer la modale de gestion des entreprises
import GestionUtilisateursModal from './GestionUtilisateursModal'; // Importer la modale de gestion des utilisateurs
import GestionSynthesesModal from './GestionSynthesesModal'; // NOUVEAU: Importer la modale de gestion des synthèses
import moment from 'moment';
// Locale setting moved to main.jsx
import { shadeColor, findAvailableShade } from './utils/colorUtils'; // Importer findAvailableShade
import { getSpecialDaysDataForRange } from './utils/holidays'; // Assurez-vous que ce chemin est correct
import { INTERVENTION_ETATS, ETAT_STYLES, ETAT_CATEGORIES, ETATS_PAR_CATEGORIE, getHachuresStyle } from './utils/interventionStates'; // Importer les états et la fonction pour les hachures
import './App.css'; // Importer le fichier CSS ici

function App() {
  const [projets, setProjets] = useState([]);
  const [unfilteredProjets, setUnfilteredProjets] = useState([]); // Pour la détection de conflit
  const [interventions, setInterventions] = useState([]);
  const [selectedIntervention, setSelectedIntervention] = useState(null);
  const [isCreatingIntervention, setIsCreatingIntervention] = useState(false);
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
  const [isGestionEntreprisesModalOpen, setIsGestionEntreprisesModalOpen] = useState(false);
  const [isGestionUtilisateursModalOpen, setIsGestionUtilisateursModalOpen] = useState(false);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [isGestionSynthesesModalOpen, setIsGestionSynthesesModalOpen] = useState(false); // NOUVEAU: État pour la modale de synthèse
  const [entreprisesList, setEntreprisesList] = useState([]); // État pour la liste des entreprises
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

  const fetchEntreprisesList = async () => {
    const { data, error } = await supabase.from('entreprises').select('id, nom'); // Récupérer id et nom
    if (error) {
      console.error("Erreur lors de la récupération de la liste des entreprises:", error);
    } else {
      setEntreprisesList(data || []);
    }
  };

  const fetchProjets = async () => {
    setIsLoadingData(true); // Indiquer le début du chargement
    //console.log("[App.jsx fetchProjets] DÉBUT du fetch de tous les projets.");

    // 1. Toujours récupérer TOUS les projets pour la logique interne (conflits, etc.)
    const { data: allProjetsData, error: allProjetsError } = await supabase
      .from('projets')
      .select('id, nom, color, user_id, lots(id, nom, projet_id, color, display_order, entreprise_id)') // Assurer que entreprise_id est sélectionné pour chaque lot
      .order('id', { ascending: true })
      .order('display_order', { foreignTable: 'lots', ascending: true });

    if (allProjetsError) {
      console.error("[App.jsx fetchProjets] Erreur lors de la récupération de tous les projets :", allProjetsError);
      setUnfilteredProjets([]);
      setProjets([]);
      setIsLoadingData(false);
      return;
    }

    if (!allProjetsData) {
      // Ce cas couvre null, undefined. Si allProjetsData est [], la condition suivante le gérera.
      console.warn("[App.jsx fetchProjets] allProjetsData est null ou undefined. unfilteredProjets sera vide.");
      setUnfilteredProjets([]);
      setProjets([]);
      setIsLoadingData(false);
      return;
    }
    
    //console.log('[App.jsx fetchProjets] allProjetsData récupéré:', JSON.parse(JSON.stringify(allProjetsData)));
    setUnfilteredProjets(allProjetsData); // Définir unfilteredProjets ici

    // 2. Filtrer les projets pour l'affichage si nécessaire
    if (currentUser && !showAllProjects) {
      const filteredProjetsForDisplay = allProjetsData.filter(p => p.user_id === currentUser.id);
      setProjets(filteredProjetsForDisplay);
    } else {
      setProjets(allProjetsData); // Afficher tous les projets
    }

    setIsLoadingData(false);
    //console.log("[App.jsx fetchProjets] FIN. unfilteredProjets length:", allProjetsData.length, "projets (pour affichage) length:", (currentUser && !showAllProjects ? allProjetsData.filter(p => p.user_id === currentUser.id) : allProjetsData).length);
  };

  const fetchLinks = async (optimisticAction = null) => {

    // Step 1: Apply optimistic action to ODL state immediately (scheduled by React)
    setOptimisticallyDeletedLinkIds(prevODL => {
        const newODL = new Set(prevODL);
        if (optimisticAction) {
            if (optimisticAction.type === 'delete' && optimisticAction.id) {
                newODL.add(optimisticAction.id);
            } else if (optimisticAction.type === 'add' && optimisticAction.id) {
                newODL.delete(optimisticAction.id);
            } else if (optimisticAction.type === 'conflict_resolved' && optimisticAction.id) {
                newODL.delete(optimisticAction.id);
            }
        }
        return newODL; // This is the state React will use for the next render cycle
    });

    // Step 2: Apply optimistic action to links state immediately (scheduled by React)
    // This provides immediate UI feedback for delete/add.
    if (optimisticAction) {
        if (optimisticAction.type === 'delete' && optimisticAction.id) {
            setLinks(prevLinks => prevLinks.filter(link => link.id !== optimisticAction.id));
        } else if (optimisticAction.type === 'add' && optimisticAction.id && optimisticAction.newLink) {
            setLinks(prevLinks => {
                if (prevLinks.some(link => link.id === optimisticAction.newLink.id)) return prevLinks;
                return [...prevLinks, optimisticAction.newLink];
            });
        }
        // No setLinks update for 'conflict_resolved' here, the fetch will handle it.
    }


    // Step 3: Fetch fresh data from Supabase
    const { data, error } = await supabase
        .from('links')
        .select('*');


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

            // Log changes to ODL
            if (idsRemovedFromODL.size > 0) {
            }

            return reconciledODL; // Return the new set to update the actual state
        });

    } else {
        console.error('Erreur fetch links:', error);
        // Handle fetch errors - maybe revert optimistic updates or show an error message
    }
};

  // Fonction consolidée pour récupérer interventions et liens
  const fetchAllData = async (optimisticLinkAction = null) => {
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
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchUsers(); // Récupérer la liste des utilisateurs
    fetchProjets();
    fetchAllData(); // Appel initial pour interventions et liens
    fetchEntreprisesList(); // Charger la liste des entreprises

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

  const handleOpenGestionEntreprisesModal = () => {
    setIsGestionEntreprisesModalOpen(true);
  };

  const handleOpenGestionUtilisateursModal = () => {
    setIsGestionUtilisateursModalOpen(true);
  };

  const handleOpenGestionSynthesesModal = () => { // NOUVEAU: Handler pour la modale de synthèse
    setIsGestionSynthesesModalOpen(true);
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

  // Lots non filtrés pour la détection de conflit
  const unfilteredLots = useMemo(() => {
    return (unfilteredProjets || []).reduce((acc, projet) => {
      if (projet.lots) {
        const lotsWithProjectContext = projet.lots.map(lot => ({
          ...lot, // inclut entreprise_id si sélectionné dans fetchProjets
          projetCouleur: projet.color || '#4a90e2',
          projectName: projet.nom,
        }));
        acc.push(...lotsWithProjectContext);
      }
      return acc;
    }, []);
  }, [unfilteredProjets]);

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
    setIsCreatingIntervention(true);
    setIsGestionInterventionModalOpen(true);
  };

  const handleEditIntervention = (interventionToEdit) => {
    setSelectedIntervention(interventionToEdit);
    setIsCreatingIntervention(false);
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
    setIsCreatingIntervention(true);
    setIsGestionInterventionModalOpen(true);
  };

  const handleCloseInterventionModal = () => {
    setIsGestionInterventionModalOpen(false);
    setSelectedIntervention(null);
    setIsCreatingIntervention(false);
    setCurrentLotIdForIntervention(null);
    fetchAllData();
  };

  const handleOpenEditProjetModal = (projet) => {
    setCurrentProjetToEdit(projet);
    setIsEditProjetModalOpen(true);
  };

  const handleOpenEditLotModal = (lot) => {
    //console.log('[App.jsx handleOpenEditLotModal] Lot to edit:', JSON.parse(JSON.stringify(lot))); // Log du lot
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
    <div className="app-main-container" style={{ display: 'flex', height: '100vh' }}> {/* Ajout de la classe app-main-container */}
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
        {/* Boutons de gestion ajoutés ici */}
        <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button 
            onClick={handleOpenGestionEntreprisesModal} 
            style={{ width: '100%', textAlign: 'left', padding: '8px 10px', justifyContent: 'flex-start' }}
          >
            Gérer les Entreprises
          </button>
          <button 
            onClick={handleOpenGestionUtilisateursModal} 
            style={{ width: '100%', textAlign: 'left', padding: '8px 10px', justifyContent: 'flex-start' }}
          >
            Gérer les Utilisateurs
          </button>
          <button // NOUVEAU: Bouton pour la gestion des synthèses
            onClick={handleOpenGestionSynthesesModal}
            style={{ width: '100%', textAlign: 'left', padding: '8px 10px', justifyContent: 'flex-start' }}
          >
            Gestion des Synthèses Mail
          </button>
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
                      if (provided.placeholder) {
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
            onOpenGestionEntreprisesModal={handleOpenGestionEntreprisesModal} // Assurez-vous que le nom de la prop correspond
          />
        </Modal>
      )}

      {isGestionInterventionModalOpen && (
        <Modal isOpen={isGestionInterventionModalOpen} onClose={handleCloseInterventionModal}>
          <h3 style={{ marginTop: 0 }}>
            {isCreatingIntervention ? `Nouvelle Intervention ${currentLotIdForIntervention ? `pour Lot ${lots.find(l => l.id === currentLotIdForIntervention)?.nom || `ID ${currentLotIdForIntervention}`}` : ''}` : `Modifier l'Intervention ${selectedIntervention?.nom || ''}`}
          </h3>
          <GestionInterventions
            allLots={unfilteredLots} // Utiliser les lots non filtrés pour la logique interne de la modale
            allProjets={unfilteredProjets} // Utiliser les projets non filtrés
            allInterventions={interventions} // Toutes les interventions sont déjà globales
            entreprisesList={entreprisesList} // Passer la liste des entreprises
            selectedIntervention={selectedIntervention}
            isCreating={isCreatingIntervention}
            onRefreshCalendar={() => { fetchAllData(); handleCloseInterventionModal(); }}
            onCloseForm={handleCloseInterventionModal}
            initialLotId={isCreatingIntervention ? currentLotIdForIntervention : selectedIntervention?.lot_id} // Correction: isCreatingIntervention
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
            }}
            onOpenGestionEntreprisesModal={handleOpenGestionEntreprisesModal} // Ajouter cette prop ici
          />
        </Modal>
      )}
      {isCreateUserModalOpen && (
        <Modal isOpen={isCreateUserModalOpen} onClose={() => setIsCreateUserModalOpen(false)}>
          <h3 style={{ marginTop: 0 }}>Nouvel Utilisateur</h3>
          <CreateUser onUserAdded={handleUserAdded} onCancel={() => setIsCreateUserModalOpen(false)} />
        </Modal>
      )}

      {isGestionEntreprisesModalOpen && (
        <Modal isOpen={isGestionEntreprisesModalOpen} onClose={() => setIsGestionEntreprisesModalOpen(false)}>
          <GestionEntreprisesModal
            isOpen={isGestionEntreprisesModalOpen}
            onClose={() => setIsGestionEntreprisesModalOpen(false)}
            onEntrepriseAddedOrUpdated={() => {
              // Optionnel: rafraîchir des données si nécessaire, par exemple si les lots affichent des noms d'entreprises
              // fetchProjets(); // ou fetchAllData();
            }}
          />
        </Modal>
      )}

      {isGestionUtilisateursModalOpen && (
        <Modal isOpen={isGestionUtilisateursModalOpen} onClose={() => setIsGestionUtilisateursModalOpen(false)}>
          <GestionUtilisateursModal
            isOpen={isGestionUtilisateursModalOpen}
            onClose={() => setIsGestionUtilisateursModalOpen(false)}
            onUserAddedOrUpdated={fetchUsers} // Rafraîchir la liste des utilisateurs après ajout/modif
          />
        </Modal>
      )}

      {/* NOUVEAU: Modale de Gestion des Synthèses */}
      {isGestionSynthesesModalOpen && (
        <Modal isOpen={isGestionSynthesesModalOpen} onClose={() => setIsGestionSynthesesModalOpen(false)}>
          <GestionSynthesesModal
            usersList={usersList} // Passer la liste des utilisateurs pour la sélection des destinataires
            currentUser={currentUser} // L'utilisateur actuel pourrait être un destinataire par défaut
            onClose={() => setIsGestionSynthesesModalOpen(false)}
            // D'autres props pourraient être nécessaires, comme les fonctions pour sauvegarder la config
            // et pour déclencher l'envoi manuel.
          />
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
          entreprisesList={entreprisesList}
          projetsForConflictCheck={unfilteredProjets} // Passer les projets non filtrés pour la détection de conflit
          showCurrentDayIndicator={showCurrentDayIndicator} // Passer le nouvel état
          numberOfMonthsToDisplay={numberOfMonthsForGrid} // Passer le nombre de mois calculé
        />
      </div>
    </div>
  );
}

export default App;
