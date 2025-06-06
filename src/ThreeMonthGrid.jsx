// c:\Users\Cynthia\planning-app\planning-app\src\ThreeMonthGrid.jsx
import React, { useMemo, useLayoutEffect, useEffect, useState, useCallback, useRef } from 'react';
import 'moment/locale/fr';
import moment from 'moment';
import './ThreeMonthGrid.css';
import { generateProjectColors, generateInterventionColors } from './utils/colorUtils';
import { isPublicHoliday, isSchoolVacationZoneB } from './utils/holidays';
import { supabase } from './lib/supabaseClient';
import Modal from './Modal';
import { useInterventionLinking } from './hooks/useInterventionLinking';
// import Modal from './Modal';

export default function ThreeMonthGrid({
  interventions,
  links,
  projets = [],
  expandedProjetsState = {},
  projectLotsVisibilityState,
  onToggleProjectLotsVisibility,
  expandedLotInterventionsState,
  onToggleLotInterventions,
  onEditIntervention,
  onAddIntervention,
  onEditLot,
  onInterventionUpdated,
  onEditProjet,
  specialDaysData,
  isLoadingSpecialDays,
  currentStartDate,
  onPreviousMonth,
  onNextMonth,
  refetchLinks,
  isLoadingData // Nouvelle prop
}) {
  const svgDrawingLayerRef = useRef(null);

  const [isResizing, setIsResizing] = useState(false);
  const [resizingInfo, setResizingInfo] = useState(null);
  const resizingCellRef = useRef(null);
  const [resizePreviewSpan, setResizePreviewSpan] = useState(null);
  const wasResizingJustNow = useRef(false); // Pour distinguer un clic post-redimensionnement
  const [svgOverlayPosition, setSvgOverlayPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const theadRef = useRef(null); // Ref for the table header
  const tableRef = useRef(null);

  const INTERVENTION_CELL_HEIGHT = '28px'; // Hauteur uniforme pour les cellules d'intervention
  const INTERVENTION_CELL_VERTICAL_PADDING = '3px';

  // Définir MANUAL_Y_OFFSET ici pour qu'il soit stable et accessible par les deux hooks d'effet.
  // Si les flèches sont trop basses de ~2 lignes (2 * 28px = 56px),
  // un offset Y positif pour svgOverlayPosition.top déplace le SVG vers le bas,
  // ce qui fait que les coordonnées Y calculées dans le SVG (handleY - svgTop) diminuent, remontant les flèches.
  const MANUAL_Y_OFFSET = 0; // Remplacé par la mesure de theadHeight
  // Déplacer la définition des styles ici, avant leur utilisation dans le hook
  const dayHeaderStyle = {
    width: '18px',
    textAlign: 'center',
    padding: `${INTERVENTION_CELL_VERTICAL_PADDING} 0`,
    fontSize: '0.8em',
    borderBottom: '1px solid #ddd',
    borderRight: '1px solid #eee',
    height: INTERVENTION_CELL_HEIGHT, // Optionnel, pour aligner la hauteur de l'en-tête des jours
    boxSizing: 'border-box',
  };

  const dayCellStyle = {
    width: dayHeaderStyle.width,
    minWidth: dayHeaderStyle.width,
    maxWidth: dayHeaderStyle.width,
    height: INTERVENTION_CELL_HEIGHT,
    padding: `${INTERVENTION_CELL_VERTICAL_PADDING} 2px`,
    border: '1px solid #eee',
    boxSizing: 'border-box',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
  };
  const {
    isLinking,
    setIsLinking,
    linkDragInfo,
    setLinkDragInfo,
    isDeleteLinkModalOpen,
    linkToDelete,
    handleLinkDragStart,
    handleLinkDropOnHandle,
    drawPermanentLinks,
    handleOpenDeleteLinkModal,
    handleDeleteLink,
    removeTemporaryLink,
  } = useInterventionLinking({
    interventions, links, refetchLinks, svgDrawingLayerRef, tableRef, dayCellStyle, isLoadingData
  });

  const projectHeaderStyle = {
    backgroundColor: '#f5f5f5',
    borderRight: '1px solid #ccc',
    fontWeight: 'bold',
    padding: '5px 10px',
    borderTop: '2px solid #888',
    borderBottom: '1px solid #ddd',
    whiteSpace: 'nowrap',
    verticalAlign: 'top',
  };

  const lotHeaderStyle = {
    backgroundColor: '#f9f9f9',
    borderRight: '1px solid #ccc',
    paddingLeft: '20px',
    fontStyle: 'italic',
    borderTop: '1px solid #bbb',
    borderBottom: '1px solid #eee',
    padding: '5px',
    whiteSpace: 'nowrap',
    verticalAlign: 'top',
  };

  const interventionNameStyle = {
    backgroundColor: '#ffffff',
    borderRight: '1px solid #ccc',
    padding: `${INTERVENTION_CELL_VERTICAL_PADDING} 5px ${INTERVENTION_CELL_VERTICAL_PADDING} 10px`,
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
    borderTop: '1px solid #eee',
    height: INTERVENTION_CELL_HEIGHT,
    boxSizing: 'border-box',
  };

  const projectDayCellStyle = {
    ...dayCellStyle,
    borderTop: '2px solid #888',
    borderBottom: '1px solid #eee',
  };

  const lotRowDayCellStyle = {
    ...dayCellStyle,
    borderTop: '1px solid #bbb',
  };

  const interventionRowDayCellStyle = {
    ...dayCellStyle,
    borderTop: '1px solid #eee',
  };

  const holidayCellStyle = { backgroundColor: '#e0e0e0' };

  // Styles pour les en-têtes de tableau (déplacés ici pour être définis avant utilisation)
  const commonHeaderCellStyle = { width: 'auto', backgroundColor: 'white', borderRight: '1px solid #ccc', whiteSpace: 'nowrap' };
  const monthHeaderStyle = { textAlign: 'center', borderBottom: '1px solid #ddd', borderTop: '1px solid #ccc', borderRight: '1px solid #ccc' };
  const weekHeaderStyle = { textAlign: 'center', borderBottom: '1px solid #ddd', fontSize: '0.9em', borderRight: '1px solid #ddd' };


  const findDateCellByPoint = (clientX, clientY, tableElement) => {
    if (!tableElement) return null;
    const headerDateCells = tableElement.querySelectorAll('thead th[data-date]');
    for (const cell of headerDateCells) {
      const rect = cell.getBoundingClientRect();
      const tableRect = tableElement.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right &&
          clientY >= tableRect.top && clientY <= tableRect.bottom) {
        return cell;
      }
    }
    return null;
  };

  const checkIsPublicHoliday = useCallback((date) => {
    if (isLoadingSpecialDays || !specialDaysData || !specialDaysData.publicHolidays) return false;
    return isPublicHoliday(date, specialDaysData.publicHolidays);
  }, [isLoadingSpecialDays, specialDaysData]);

  const checkIsSchoolVacationZoneB = useCallback((date) => {
    if (isLoadingSpecialDays || !specialDaysData || !specialDaysData.schoolVacations) return false;
    return isSchoolVacationZoneB(date, specialDaysData.schoolVacations);
  }, [isLoadingSpecialDays, specialDaysData]);

  const startDateOfView = useMemo(() => moment(currentStartDate).startOf('month'), [currentStartDate]);
  const endDateOfView = useMemo(() => moment(startDateOfView).add(2, 'months').endOf('month'), [startDateOfView]);

  const daysRange = useMemo(() => {
    const arr = [];
    let cur = moment(startDateOfView);
    while (cur.isSameOrBefore(endDateOfView)) {
      if (cur.day() !== 0 && cur.day() !== 6) {
        arr.push(cur.clone());
      }
      cur.add(1, 'day');
    }
    return arr;
  }, [startDateOfView, endDateOfView]);

  const findInterventionById = useCallback((id) => {
    return interventions.find(iv => iv.id === id);
  }, [interventions]);

  const months = useMemo(() => {
    const groups = [];
    daysRange.forEach((d, index) => {
      const m = d.format('MMMM');
      if (!groups.length || groups[groups.length - 1].label !== m) {
        groups.push({ label: m, count: 1, startIndex: index });
      } else {
        groups[groups.length - 1].count += 1;
      }
    });
    return groups;
  }, [daysRange]);

  const weeks = useMemo(() => {
    const groups = [];
    daysRange.forEach((d, index) => {
      const w = `${d.isoWeek()}`;
      if (!groups.length || groups[groups.length - 1].week !== w) {
        groups.push({ week: w, count: 1, startIndex: index });
      } else {
        groups[groups.length - 1].count += 1;
      }
    });
    return groups;
  }, [daysRange]);

  const projectColors = useMemo(() => generateProjectColors(projets), [projets]);
  const colorMap = useMemo(() => generateInterventionColors(interventions, projectColors), [interventions, projectColors]);

  const calculateBusinessDaysDuration = (startDate, endDate) => {
    let duration = 0;
    let currentDate = moment(startDate).clone();
    const endMoment = moment(endDate);
    while (currentDate.isSameOrBefore(endMoment, 'day')) {
      if (currentDate.day() !== 0 && currentDate.day() !== 6) duration++;
      currentDate.add(1, 'day');
    }
    return duration;
  };

  const addBusinessDays = (startDate, businessDaysToAdd) => {
    let currentDate = moment(startDate).clone();
    while (currentDate.day() === 0 || currentDate.day() === 6) {
      currentDate.add(1, 'day');
    }

    if (businessDaysToAdd <= 0) return currentDate;
    if (businessDaysToAdd === 1) return currentDate;

    let daysEffectivelyAdded = 0;
    let remainingBusinessDays = businessDaysToAdd - 1;

    while (daysEffectivelyAdded < remainingBusinessDays) {
      currentDate.add(1, 'day');
      if (currentDate.day() !== 0 && currentDate.day() !== 6) {
        daysEffectivelyAdded++;
      }
    }
    return currentDate;
  };

  // Helper to adjust a date to the next business day if it falls on a weekend
  const adjustToNextBusinessDay = (dateMoment) => {
    let adjustedDate = dateMoment.clone();
    while (adjustedDate.day() === 0 || adjustedDate.day() === 6) {
      adjustedDate.add(1, 'day');
    }
    return adjustedDate;
  };

  const handleResizeStart = useCallback((e, interventionData, direction) => {
    e.preventDefault();
    e.stopPropagation(); // Empêche le drag start de se déclencher en même temps
    wasResizingJustNow.current = true; // Indiquer qu'un redimensionnement a commencé

    setIsResizing(true);
    setResizingInfo({
      interventionId: interventionData.id,
      originalStart: interventionData.start.clone(),
      originalEnd: interventionData.end.clone(),
      direction: direction,
      lotId: interventionData.raw.lot_id // Ajouter lotId pour le style de prévisualisation potentiel
    });
    resizingCellRef.current = e.currentTarget.closest('td');
  }, [setIsResizing, setResizingInfo, resizingCellRef /* wasResizingJustNow n'est pas une dépendance car c'est une ref */]);

  const handleDrop = async (e, newDate) => {
    e.preventDefault();
    const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
    const draggedInterventionId = dragData.id;
    const originalDraggedIntervention = findInterventionById(draggedInterventionId);

    if (!originalDraggedIntervention) {
      console.error('[handleDrop] Intervention source (glissée) introuvable:', draggedInterventionId);
      return;
    }

    const originalStartMomentForDragged = moment(originalDraggedIntervention.date);
    const originalEndMomentForDragged = moment(originalDraggedIntervention.date_fin || originalDraggedIntervention.date);

    if (!originalStartMomentForDragged.isValid() || !originalEndMomentForDragged.isValid()) {
       console.error('[handleDrop] Dates originales invalides pour l\'intervention glissée:', originalDraggedIntervention);
       return;
    }
    const clickedDayMoment = moment(dragData.clickedDayMoment); // Get the clicked day moment from payload
    const dropTargetDate = moment(newDate);

    // Calculate the difference between the drop date and the clicked date
    const dateDifference = dropTargetDate.diff(clickedDayMoment, 'days');
    // The new start date is the original start date plus this difference
    let newDebMomentForDragged = originalStartMomentForDragged.clone().add(dateDifference, 'days');

    newDebMomentForDragged = adjustToNextBusinessDay(newDebMomentForDragged);

    const businessDayDurationForDragged = calculateBusinessDaysDuration(originalStartMomentForDragged, originalEndMomentForDragged);
    const newFinMomentForDragged = addBusinessDays(newDebMomentForDragged, businessDayDurationForDragged > 0 ? businessDayDurationForDragged : 1);

    const newDebForDraggedStr = newDebMomentForDragged.format('YYYY-MM-DD');
    const newFinForDraggedStr = newFinMomentForDragged.format('YYYY-MM-DD');

    console.log(`[handleDrop] Vérification des dates. Original Start: ${originalStartMomentForDragged.format('YYYY-MM-DD')}, Original End: ${originalEndMomentForDragged.format('YYYY-MM-DD')}`);
    console.log(`[handleDrop] Vérification des dates. Calculated New Start: ${newDebForDraggedStr}, Calculated New End: ${newFinForDraggedStr}`);

        // Si les dates (ajustées aux jours ouvrés) n'ont pas changé, ne rien faire.
        if (newDebForDraggedStr === originalStartMomentForDragged.format('YYYY-MM-DD') && newFinForDraggedStr === originalEndMomentForDragged.format('YYYY-MM-DD')) {
            console.log('[handleDrop] Intervention glissée: les dates (jours ouvrés) N\'ONT PAS CHANGÉ. Aucune mise à jour ou cascade nécessaire.');
            return;
        }
    console.log('[handleDrop] Intervention glissée: les dates (jours ouvrés) ONT CHANGÉ. Procède à la mise à jour.');

    const updatesToPerform = [];
    const processedIds = new Set();
    const queue = [];

    updatesToPerform.push({
        id: draggedInterventionId,
        date: newDebForDraggedStr,
        date_fin: newFinForDraggedStr,
    });
    processedIds.add(draggedInterventionId);
    queue.push(draggedInterventionId);

    while (queue.length > 0) {
        // Get the source intervention's original data and its *new* calculated dates
        const currentSourceId = queue.shift();
        const currentSourceOriginal = findInterventionById(currentSourceId);
        const currentSourceUpdatedData = updatesToPerform.find(u => u.id === currentSourceId);
        if (!currentSourceOriginal || !currentSourceUpdatedData) {
             console.warn(`[handleDrop Cascade] Source ${currentSourceId} data missing.`);
             continue;
        }

        const outgoingLinksFromSource = links.filter(link => link.source_intervention_id === currentSourceId);

        for (const link of outgoingLinksFromSource) {
            const targetId = link.target_intervention_id;
            if (processedIds.has(targetId)) continue;

            const targetInterventionOriginal = findInterventionById(targetId);
            if (!targetInterventionOriginal) {
                console.warn(`[handleDrop Cascade] Intervention cible ${targetId} introuvable pour le lien ${link.id}.`);
                continue;
            }

            const originalTargetStartMoment = moment(targetInterventionOriginal.date);
            const originalTargetEndMoment = moment(targetInterventionOriginal.date_fin || targetInterventionOriginal.date);
            const targetBusinessDayDuration = calculateBusinessDaysDuration(originalTargetStartMoment, originalTargetEndMoment);

            // Calculate the original gap based on link type
            let originalGapDays = 0;
            const originalSourceStartMoment = moment(currentSourceOriginal.date);
            const originalSourceEndMoment = moment(currentSourceOriginal.date_fin || currentSourceOriginal.date);

            if (link.link_type === 'finish-to-start') {
                 originalGapDays = originalTargetStartMoment.diff(originalSourceEndMoment, 'days');
            } else if (link.link_type === 'start-to-start') {
                 originalGapDays = originalTargetStartMoment.diff(originalSourceStartMoment, 'days');
            }
            // Add other link types here if needed (SF, FF)

            // Calculate the new theoretical start date for the target based on the NEW source date + original gap
            let newTargetDebTheoreticalMoment;
            if (link.link_type === 'finish-to-start') {
                newTargetDebTheoreticalMoment = moment(currentSourceUpdatedData.date_fin).add(originalGapDays, 'days');
            } else { // Default to start-based for SS, SF, FF - adjust if needed
                newTargetDebTheoreticalMoment = moment(currentSourceUpdatedData.date).add(originalGapDays, 'days');
            }
            let newTargetDebMoment = adjustToNextBusinessDay(newTargetDebTheoreticalMoment);
            const newTargetFinMoment = addBusinessDays(newTargetDebMoment, targetBusinessDayDuration > 0 ? targetBusinessDayDuration : 1); // Preserve original business duration

            updatesToPerform.push({
                id: targetId,
                date: newTargetDebMoment.format('YYYY-MM-DD'),
                date_fin: newTargetFinMoment.format('YYYY-MM-DD'),
            });
            processedIds.add(targetId);
            queue.push(targetId);
        }
    }

    console.log('[handleDrop] Toutes les mises à jour à effectuer en cascade:', updatesToPerform);

    if (updatesToPerform.length > 0) {
        const updatePromises = updatesToPerform.map(u =>
            supabase.from('interventions').update({ date: u.date, date_fin: u.date_fin }).eq('id', u.id)
        );
        try {
            const results = await Promise.all(updatePromises);
            results.forEach((result, index) => {
                if (result.error) console.error(`[handleDrop Cascade] Erreur MàJ intervention ${updatesToPerform[index].id}:`, result.error);
            });
            console.log('[handleDrop] Toutes les interventions en cascade ont été (tentées) mises à jour.');
        } catch (error) {
            console.error('[handleDrop] Erreur lors de la mise à jour en batch des interventions en cascade:', error);
        }
    }

    if (onInterventionUpdated) onInterventionUpdated();
  };

  const handleResizeMouseMove = useCallback((e) => {
    if (!isResizing || !resizingInfo || !resizingCellRef.current) return;
    e.preventDefault();
    const handles = resizingCellRef.current.querySelectorAll('.resize-handle');
    handles.forEach(h => h.style.visibility = 'hidden');
    const targetDateCell = findDateCellByPoint(e.clientX, e.clientY, tableRef.current);
    handles.forEach(h => h.style.visibility = 'visible');

    if (targetDateCell?.dataset.date) {
      const hoverDateMoment = moment(targetDateCell.dataset.date);
      let potentialStart = resizingInfo.originalStart.clone();
      let potentialEnd = resizingInfo.originalEnd.clone();
      if (resizingInfo.direction === 'right') potentialEnd = hoverDateMoment;
      else potentialStart = hoverDateMoment;
      if (potentialStart.isAfter(potentialEnd)) {
        if (resizingInfo.direction === 'right') potentialStart = potentialEnd.clone();
        else potentialEnd = potentialStart.clone();
      }
      setResizePreviewSpan({ start: potentialStart, end: potentialEnd });
    } else {
        let fallbackDateFound = false;
        if (tableRef.current && resizingInfo) {
            let potentialHoverDateMoment = null;
            const dayElementsWithRects = daysRange.map(day => {
                const dayStr = day.format('YYYY-MM-DD');
                const cellElement = tableRef.current.querySelector(`thead th[data-date="${dayStr}"]`);
                return cellElement ? { dayMoment: day, rect: cellElement.getBoundingClientRect() } : null;
            }).filter(Boolean);

            if (dayElementsWithRects.length > 0) {
                let minDistance = Infinity;
                let bestMatchDayMoment = null;
                for (const item of dayElementsWithRects) {
                    const cellCenter = item.rect.left + item.rect.width / 2;
                    const distance = Math.abs(e.clientX - cellCenter);
                    if (distance < minDistance) {
                        minDistance = distance;
                        bestMatchDayMoment = item.dayMoment;
                    }
                }
                if (bestMatchDayMoment) potentialHoverDateMoment = bestMatchDayMoment.clone();
            }

            if (potentialHoverDateMoment) {
                let potentialStart = resizingInfo.originalStart.clone();
                let potentialEnd = resizingInfo.originalEnd.clone();
                if (resizingInfo.direction === 'right') potentialEnd = potentialHoverDateMoment;
                else potentialStart = potentialHoverDateMoment;
                if (potentialStart.isAfter(potentialEnd)) {
                    if (resizingInfo.direction === 'right') potentialStart = potentialEnd.clone();
                    else potentialEnd = potentialStart.clone();
                }
                setResizePreviewSpan({ start: potentialStart, end: potentialEnd });
                fallbackDateFound = true;
            }
        }
        if (!fallbackDateFound) console.warn('[ResizeMouseMove] Mouse not over a valid date cell and fallback failed.');
    }
  }, [isResizing, resizingInfo, tableRef, resizingCellRef, daysRange]);

  const handleResizeMouseUp = useCallback(async (e) => {
    if (!isResizing || !resizingInfo) return;
    window.removeEventListener('mousemove', handleResizeMouseMove);
    window.removeEventListener('mouseup', handleResizeMouseUp);
    setIsResizing(false);

    let finalDateStr = null;
    if (resizingCellRef.current && tableRef.current) {
      const handles = resizingCellRef.current.querySelectorAll('.resize-handle');
      handles.forEach(h => h.style.visibility = 'hidden');
      const finalTargetDateCell = findDateCellByPoint(e.clientX, e.clientY, tableRef.current);
      handles.forEach(h => h.style.visibility = 'visible');
      if (finalTargetDateCell?.dataset.date) finalDateStr = finalTargetDateCell.dataset.date;
    }

    if (!finalDateStr && resizePreviewSpan) {
      if (resizingInfo.direction === 'right' && resizePreviewSpan.end?.isValid()) finalDateStr = resizePreviewSpan.end.format('YYYY-MM-DD');
      else if (resizingInfo.direction === 'left' && resizePreviewSpan.start?.isValid()) finalDateStr = resizePreviewSpan.start.format('YYYY-MM-DD');
    }

    if (finalDateStr) {
      let finalDateMoment = moment(finalDateStr);
      const resizedInterventionId = resizingInfo.interventionId;
      const originalResizedIntervention = findInterventionById(resizedInterventionId);
      const originalResizedStartMoment = moment(originalResizedIntervention.date);
      const originalResizedEndMoment = moment(originalResizedIntervention.date_fin || originalResizedIntervention.date);

      let newDbStartMoment = originalResizedStartMoment.clone();
      let newDbEndMoment = originalResizedEndMoment.clone();

      if (resizingInfo.direction === 'right') {
         newDbEndMoment = finalDateMoment;
         while(newDbEndMoment.day() === 0 || newDbEndMoment.day() === 6) {
             newDbEndMoment.subtract(1, 'day');
         }
         if (newDbEndMoment.isBefore(newDbStartMoment)) newDbEndMoment = newDbStartMoment.clone();
      } else {
         newDbStartMoment = finalDateMoment;
         while(newDbStartMoment.day() === 0 || newDbStartMoment.day() === 6) {
             newDbStartMoment.add(1, 'day');
         }
         if (newDbStartMoment.isAfter(newDbEndMoment)) newDbStartMoment = newDbEndMoment.clone();
      }

      const newDbStart = newDbStartMoment.format('YYYY-MM-DD');
      const newDbEnd = newDbEndMoment.format('YYYY-MM-DD');

      if (newDbStart !== originalResizedStartMoment.format('YYYY-MM-DD') || newDbEnd !== originalResizedEndMoment.format('YYYY-MM-DD')) {
        console.log(`[ResizeMouseUp] Intervention redimensionnée ${resizedInterventionId}: ${originalResizedStartMoment.format('YYYY-MM-DD')}-${originalResizedEndMoment.format('YYYY-MM-DD')} -> ${newDbStart}-${newDbEnd}`);

        const updatesToPerform = [];
        const processedIds = new Set();
        const queue = [];

        updatesToPerform.push({ id: resizedInterventionId, date: newDbStart, date_fin: newDbEnd });
        processedIds.add(resizedInterventionId);
        queue.push(resizedInterventionId); // Always add the resized task to start the cascade


        while (queue.length > 0) {
            const currentSourceId = queue.shift();
            const currentSourceUpdatedData = updatesToPerform.find(u => u.id === currentSourceId);
            if (!currentSourceUpdatedData) {
                console.warn(`[ResizeCascade] Updated data for source ${currentSourceId} not found.`);
                continue;
            }
            const currentSourceNewStartMoment = moment(currentSourceUpdatedData.date);
            const currentSourceNewEndMoment = moment(currentSourceUpdatedData.date_fin);

            const originalSourceIntervention = findInterventionById(currentSourceId);
             if (!originalSourceIntervention) {
                console.warn(`[ResizeCascade] Original data for source ${currentSourceId} not found.`);
                continue;
            }

            const outgoingLinksFromSource = links.filter(link => link.source_intervention_id === currentSourceId);

            for (const link of outgoingLinksFromSource) {
                const targetId = link.target_intervention_id;
                if (processedIds.has(targetId)) continue;

                const targetInterventionOriginal = findInterventionById(targetId);
                if (!targetInterventionOriginal) {
                    console.warn(`[ResizeCascade] Target ${targetId} for link ${link.id} not found.`);
                    continue;
                }

                const originalTargetStartMoment = moment(targetInterventionOriginal.date);
                const originalTargetEndMoment = moment(targetInterventionOriginal.date_fin || targetInterventionOriginal.date);
                const targetBusinessDayDuration = calculateBusinessDaysDuration(originalTargetStartMoment, originalTargetEndMoment);

                // Calculate the original gap based on link type
                let originalGapDays = 0;
                const originalSourceStartMoment = moment(originalSourceIntervention.date);
                const originalSourceEndMoment = moment(originalSourceIntervention.date_fin || originalSourceIntervention.date);

                if (link.link_type === 'finish-to-start') {
                     originalGapDays = originalTargetStartMoment.diff(originalSourceEndMoment, 'days');
                } else if (link.link_type === 'start-to-start') {
                     originalGapDays = originalTargetStartMoment.diff(originalSourceStartMoment, 'days');
                }
                // Add other link types here if needed (SF, FF)

                // Calculate the new theoretical start date for the target based on the NEW source date + original gap
                let newTargetDebTheoreticalMoment;
                if (link.link_type === 'finish-to-start') {
                    newTargetDebTheoreticalMoment = currentSourceNewEndMoment.clone().add(originalGapDays, 'days');
                } else { // Default to start-based for SS, SF, FF - adjust if needed
                    newTargetDebTheoreticalMoment = currentSourceNewStartMoment.clone().add(originalGapDays, 'days');
                }
                // Adjust newTargetDebMoment to be a business day
                let newTargetDebMoment = adjustToNextBusinessDay(newTargetDebTheoreticalMoment);

                const newTargetFinMoment = addBusinessDays(newTargetDebMoment, targetBusinessDayDuration > 0 ? targetBusinessDayDuration : 1);

                // Add or update the target in the list of updates
                const existingTargetUpdateIndex = updatesToPerform.findIndex(u => u.id === targetId);
                const updateEntry = {
                    id: targetId,
                    date: newTargetDebMoment.format('YYYY-MM-DD'),
                    date_fin: newTargetFinMoment.format('YYYY-MM-DD'),
                };
                if (existingTargetUpdateIndex !== -1) {
                    updatesToPerform[existingTargetUpdateIndex] = updateEntry;
                } else {
                    updatesToPerform.push(updateEntry);
                }
                processedIds.add(targetId);
                queue.push(targetId);
            }
        }
        console.log('[ResizeMouseUp] Mises à jour en cascade à effectuer:', updatesToPerform);
        if (updatesToPerform.length > 0) {
             const updatePromises = updatesToPerform.map(u => supabase.from('interventions').update({ date: u.date, date_fin: u.date_fin }).eq('id', u.id));
             try {
                await Promise.all(updatePromises);
                console.log('[ResizeCascade] Toutes les interventions en cascade ont été mises à jour.');
             } catch (err) {
                console.error("[ResizeCascade] Erreur lors de la mise à jour en batch :", err);
             }
        }
        if (onInterventionUpdated) onInterventionUpdated();

      } else {
         console.log('[ResizeMouseUp] Les dates (ajustées pour jours ouvrés) n\'ont pas changé.');
      }
    } else {
      console.warn('[ResizeMouseUp] No data-date found for target.');
    }

    if (resizingCellRef.current) {
      resizingCellRef.current.style.pointerEvents = 'auto';
      resizingCellRef.current = null;
    }
    setResizePreviewSpan(null);
    setResizingInfo(null);
  }, [isResizing, resizingInfo, onInterventionUpdated, handleResizeMouseMove, resizePreviewSpan, tableRef, resizingCellRef, links, findInterventionById, calculateBusinessDaysDuration, addBusinessDays]);

  useLayoutEffect(() => {
    // Utiliser un micro-tâche pour s'assurer que le DOM est mis à jour avant de dessiner
    if (tableRef.current && theadRef.current) {
      // Cet effet met à jour la position et la taille du conteneur SVG
      const theadHeight = theadRef.current.offsetHeight;
      console.log('[SVG Layout] theadRef.current.offsetHeight:', theadHeight);

      console.log('[SVG Layout] tableRef.current.offsetTop:', tableRef.current.offsetTop);
      console.log('[SVG Layout] tableRef.current.offsetLeft:', tableRef.current.offsetLeft);
      console.log('[SVG Layout] tableRef.current.offsetWidth:', tableRef.current.offsetWidth);
      console.log('[SVG Layout] tableRef.current.offsetHeight:', tableRef.current.offsetHeight);
      const tableRectForLayout = tableRef.current.getBoundingClientRect();
      console.log('[SVG Layout] tableRef.current.getBoundingClientRect():', { top: tableRectForLayout.top, left: tableRectForLayout.left, width: tableRectForLayout.width, height: tableRectForLayout.height });
      const newPosition = {
        top: tableRef.current.offsetTop + theadHeight, // Positionne le SVG au début du tbody
        left: tableRef.current.offsetLeft,
        width: tableRef.current.offsetWidth,
        height: tableRef.current.offsetHeight - theadHeight, // Hauteur du SVG = hauteur du tbody
      };
      console.log('[SVG Layout] Calculated newPosition for SVG overlay:', newPosition);
      if (
        newPosition.top !== svgOverlayPosition.top ||
        newPosition.left !== svgOverlayPosition.left ||
        newPosition.width !== svgOverlayPosition.width ||
        newPosition.height !== svgOverlayPosition.height
      ) {
        setSvgOverlayPosition(newPosition);
      }
    }
  // Ajouter svgOverlayPosition au tableau des dépendances car nous le lisons dans l'effet.
  // Les dépendances sont les états qui peuvent affecter la géométrie de la table.
  }, [projets, interventions, links, daysRange, expandedProjetsState, projectLotsVisibilityState, expandedLotInterventionsState, isLoadingData, svgOverlayPosition.top, svgOverlayPosition.left, svgOverlayPosition.width, svgOverlayPosition.height, theadRef.current?.offsetHeight]);

  useEffect(() => {
    // Cet effet redessine les liens lorsque les données pertinentes changent
    // ou lorsque la position/taille du SVG (svgOverlayPosition) a été mise à jour.
    // On s'assure que le SVG a des dimensions et que l'état svgOverlayPosition
    // correspond aux dimensions prévues (incluant MANUAL_Y_OFFSET).
    if (!isLoadingData && tableRef.current && theadRef.current) {
      const expectedSvgWidth = tableRef.current.offsetWidth;
      const expectedSvgHeight = tableRef.current.offsetHeight - theadRef.current.offsetHeight; 

      if (svgOverlayPosition.width === expectedSvgWidth && svgOverlayPosition.height === expectedSvgHeight && expectedSvgHeight > 0) {
        console.log('[SVG Draw] Attempting to draw links. isLoadingData:', isLoadingData);
        console.log('[SVG Draw] svgOverlayPosition used for drawing (MATCHES EXPECTED WITH OFFSET):', svgOverlayPosition);
        if (tableRef.current) {
          const tableRectForDraw = tableRef.current.getBoundingClientRect();
          console.log('[SVG Draw] tableRef.current.getBoundingClientRect() at draw time:', { top: tableRectForDraw.top, left: tableRectForDraw.left, width: tableRectForDraw.width, height: tableRectForDraw.height });
        }
        if (svgDrawingLayerRef.current) {
          const svgActualRect = svgDrawingLayerRef.current.getBoundingClientRect();
          console.log('[SVG Draw] svgDrawingLayerRef.current.getBoundingClientRect() at draw time:', { top: svgActualRect.top, left: svgActualRect.left, width: svgActualRect.width, height: svgActualRect.height });
        }
        queueMicrotask(drawPermanentLinks);
      } else if (expectedSvgHeight > 0) {
        console.warn(`[SVG Draw] Skipped drawing: SVG state might be stale or not match expected dimensions with offset.
        SVG State: w=${svgOverlayPosition.width}, h=${svgOverlayPosition.height}
        Expected SVG: w=${expectedSvgWidth}, h=${expectedSvgHeight}`);
      }
    }
  }, [links, interventions, expandedProjetsState, projectLotsVisibilityState, expandedLotInterventionsState, isLoadingData, svgOverlayPosition, drawPermanentLinks, theadRef.current?.offsetHeight]);

  // useEffect pour les effets de bord du redimensionnement (curseur, écouteurs globaux)
  useEffect(() => {
    if (isResizing) {
      const cursor = resizingInfo?.direction === 'left' || resizingInfo?.direction === 'right' ? 'ew-resize' : 'default';
      document.body.style.cursor = cursor;
      window.addEventListener('mousemove', handleResizeMouseMove);
      window.addEventListener('mouseup', handleResizeMouseUp);
      return () => {
        document.body.style.cursor = 'default';
        window.removeEventListener('mousemove', handleResizeMouseMove);
        window.removeEventListener('mouseup', handleResizeMouseUp);
      };
    } else if (document.body.style.cursor !== 'default') {
      document.body.style.cursor = 'default';
    }
  }, [isResizing, resizingInfo, handleResizeMouseMove, handleResizeMouseUp]);

  // useEffect pour le nettoyage global du glisser-déposer des liens
  useEffect(() => {
    const handleGlobalDragEnd = (e) => {
      if (isLinking && !e.target.closest('.link-handle')) {
        removeTemporaryLink();
        setIsLinking(false);
        setLinkDragInfo(null);
      }
    };
    window.addEventListener('dragend', handleGlobalDragEnd);
    return () => {
      window.removeEventListener('dragend', handleGlobalDragEnd);
    };
  }, [isLinking, removeTemporaryLink, setIsLinking, setLinkDragInfo]);

  const handleDragOverCell = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropCell = (e, date) => handleDrop(e, date);

  const isInterventionActiveOnDay = (intervention, day) => {
    const start = moment(intervention.date);
    const end = moment(intervention.date_fin || intervention.date);
    return start.isValid() && end.isValid() && day.isBetween(start, end, 'day', '[]');
  };

  const renderCompiledProjectDayCell = (projet, day, keySuffix) => {
    const projectInterventions = interventions.filter(iv => projet.lots?.some(l => l.id === iv.lot_id));
    const isActuallyActive = projectInterventions.some(iv => isInterventionActiveOnDay(iv, day));
    const isSpecial = !isLoadingSpecialDays && (checkIsPublicHoliday(day) || checkIsSchoolVacationZoneB(day));
    const baseBgColor = isSpecial ? holidayCellStyle.backgroundColor : projectDayCellStyle.backgroundColor;
    const dynamicStyle = { ...projectDayCellStyle, backgroundColor: isActuallyActive ? (projet.color || '#e0e0e0') : baseBgColor, opacity: isActuallyActive ? 0.7 : 1 };
    return <td key={`compiled-proj-${projet.id}-day-${keySuffix}`} style={dynamicStyle} data-date={day.format('YYYY-MM-DD')} onDragOver={handleDragOverCell} onDrop={(e) => handleDropCell(e, day.format('YYYY-MM-DD'))}></td>;
  };

  const renderCompiledLotDayCell = (lot, day, keySuffix) => {
    const lotInterventions = interventions.filter(iv => iv.lot_id === lot.id);
    const isActuallyActive = lotInterventions.some(iv => isInterventionActiveOnDay(iv, day));
    let lotDisplayColor = lot.color || projets.find(p => p.id === lot.projet_id)?.color || '#d0d0d0';
    const isSpecial = !isLoadingSpecialDays && (checkIsPublicHoliday(day) || checkIsSchoolVacationZoneB(day));
    const baseBgColor = isSpecial ? holidayCellStyle.backgroundColor : lotRowDayCellStyle.backgroundColor;
    const dynamicStyle = { ...lotRowDayCellStyle, backgroundColor: isActuallyActive ? lotDisplayColor : baseBgColor, opacity: isActuallyActive ? 0.6 : 1 };
    return <td key={`compiled-lot-${lot.id}-day-${keySuffix}`} style={dynamicStyle} data-date={day.format('YYYY-MM-DD')} onDragOver={handleDragOverCell} onDrop={(e) => handleDropCell(e, day.format('YYYY-MM-DD'))}></td>;
  };

  const renderInterventionCells = (interventionData, dayIndexInDaysRange, allVisibleDaysInRange, isFirstInterventionInLot) => {
    const currentVisibleDay = allVisibleDaysInRange[dayIndexInDaysRange];
    const isSpecial = !isLoadingSpecialDays && (checkIsPublicHoliday(currentVisibleDay) || checkIsSchoolVacationZoneB(currentVisibleDay));
    const baseCellStyleForIntervention = isFirstInterventionInLot ? lotRowDayCellStyle : interventionRowDayCellStyle;
    const actualInterventionStart = interventionData.start;
    const actualInterventionEnd = interventionData.end;
    const isThisInterventionBeingResized = isResizing && resizePreviewSpan && resizingInfo?.interventionId === interventionData.id;
    let displayStartMoment = actualInterventionStart;
    let displayEndMoment = actualInterventionEnd;
    let applyPreviewStyleToMainBlock = false;

    if (isThisInterventionBeingResized) {
      displayStartMoment = resizePreviewSpan.start;
      displayEndMoment = resizePreviewSpan.end;
      applyPreviewStyleToMainBlock = true;
    }

    if (!displayStartMoment?.isValid() || !displayEndMoment?.isValid()) {
      console.error("Dates invalides:", interventionData);
      return <td key={`invalid-int-${interventionData.id}-${dayIndexInDaysRange}`} style={isSpecial ? { ...baseCellStyleForIntervention, ...holidayCellStyle } : { ...baseCellStyleForIntervention }}>Date Invalide</td>;
    }

    const isCurrentDayInDisplaySpan = currentVisibleDay.isBetween(displayStartMoment, displayEndMoment, 'day', '[]');
    if (!isCurrentDayInDisplaySpan) {
      return <td key={`empty-for-${interventionData.id}-day-${dayIndexInDaysRange}`} data-date={currentVisibleDay.format('YYYY-MM-DD')} onDragOver={handleDragOverCell} onDrop={(e) => handleDropCell(e, currentVisibleDay.format('YYYY-MM-DD'))} style={isSpecial ? { ...baseCellStyleForIntervention, ...holidayCellStyle } : { ...baseCellStyleForIntervention }}></td>;
    }

    let isFirstDayOfDisplaySpanInGrid = currentVisibleDay.isSameOrAfter(displayStartMoment, 'day') &&
                                        !daysRange.slice(0, dayIndexInDaysRange).some(d => d.isBetween(displayStartMoment, displayEndMoment, 'day', '[]'));

    if (isFirstDayOfDisplaySpanInGrid) {
      let colSpan = 0;
      for (let i = dayIndexInDaysRange; i < daysRange.length; i++) {
        if (daysRange[i].isBetween(displayStartMoment, displayEndMoment, 'day', '[]')) {
          colSpan++;
        } else {
          break;
        }
      }
      if (colSpan === 0 && isCurrentDayInDisplaySpan) colSpan = 1;

      if (colSpan === 0) {
         let cellStyle = isSpecial ? { ...baseCellStyleForIntervention, ...holidayCellStyle } : { ...baseCellStyleForIntervention };
         if (applyPreviewStyleToMainBlock) { cellStyle.backgroundColor = 'rgba(0, 100, 255, 0.2)'; cellStyle.outline = '1px dashed rgba(0, 100, 255, 0.5)';}
         return <td key={`zero-colspan-int-${interventionData.id}-${dayIndexInDaysRange}`} style={cellStyle} data-date={currentVisibleDay.format('YYYY-MM-DD')}></td>;
      }

      const originalColor = colorMap[interventionData.id] || '#66aaff';
      let cellDynamicStyle = { 
        ...baseCellStyleForIntervention, // Hérite height, boxSizing, vertical padding de dayCellStyle
        position: 'relative', 
        zIndex: 6, 
        backgroundColor: originalColor, 
        color: 'white', 
        textAlign: 'center', 
        padding: `${INTERVENTION_CELL_VERTICAL_PADDING} 5px`, // Assure le même padding vertical, ajuste le padding horizontal
        overflow: 'visible', 
        borderRadius: '3px', 
        fontWeight: 'bold', 
        fontSize: '0.85em', cursor: 'pointer', textShadow: `-1px -1px 0 #aaa, 1px -1px 0 #aaa, -1px 1px 0 #aaa, 1px 1px 0 #aaa, -1px 0 0 #aaa, 1px 0 0 #aaa, 0 -1px 0 #aaa, 0 1px 0 #aaa` };
      if (applyPreviewStyleToMainBlock) {
        cellDynamicStyle = { ...cellDynamicStyle, backgroundColor: 'rgba(0, 100, 255, 0.3)', outline: '2px dashed rgba(0, 80, 200, 0.7)', outlineOffset: '-2px', color: 'rgba(0,0,0,0.6)', textShadow: 'none' };
      }

      return (
        <td
          key={`int-block-${interventionData.id}-${dayIndexInDaysRange}`}
          className="intervention-block-td" // Classe ajoutée pour le ciblage CSS des poignées
          data-date={displayStartMoment.format('YYYY-MM-DD')} onDragOver={handleDragOverCell}
          onDrop={(e) => {
            const actualTargetDateCell = findDateCellByPoint(e.clientX, e.clientY, tableRef.current);
            const dropDate = actualTargetDateCell?.dataset.date || displayStartMoment.format('YYYY-MM-DD'); // Fallback au début du bloc
            handleDropCell(e, dropDate);
          }} colSpan={colSpan} style={cellDynamicStyle} draggable
          onDragStart={(e) => {
            const tdElement = e.currentTarget;
            console.log('[onDragStart] Event Target:', e.target); // L'élément exact cliqué
            console.log('[onDragStart] Event CurrentTarget:', e.currentTarget); // L'élément sur lequel l'écouteur est attaché (le TD)
            const rect = tdElement.getBoundingClientRect();
            const clickXRelativeToCell = e.clientX - rect.left;
            const dayColumnWidth = parseInt(dayHeaderStyle.width, 10) || 18;
            const dayIndexWithinRenderedBlock = (dayColumnWidth > 0) ? Math.floor(clickXRelativeToCell / dayColumnWidth) : 0;
            const firstDayOfRenderedBlockInGrid = daysRange[dayIndexInDaysRange];
            const clickedDayMoment = firstDayOfRenderedBlockInGrid.clone().add(dayIndexWithinRenderedBlock, 'days');
            const clickedDayOffset = clickedDayMoment.diff(actualInterventionStart, 'days');

            console.log(`[onDragStart] Intervention: ${interventionData.raw.nom}, ID: ${interventionData.id}`);
            console.log(`[onDragStart] Click event clientX: ${e.clientX}, clientY: ${e.clientY}`);
            console.log(`[onDragStart] dayIndexWithinRenderedBlock: ${dayIndexWithinRenderedBlock}`);
            console.log(`[onDragStart] Calculated clickedDayMoment: ${clickedDayMoment.format('YYYY-MM-DD')}`);

            console.log(`[onDragStart] Intervention: ${interventionData.raw.nom}, Début réel: ${actualInterventionStart.format('YYYY-MM-DD')}, Jour cliqué: ${clickedDayMoment.format('YYYY-MM-DD')}, Offset calculé (calendaire): ${clickedDayOffset}`);

            const dragPayload = {
              id: interventionData.id,
              date: actualInterventionStart.format('YYYY-MM-DD'),
              date_fin: actualInterventionEnd.format('YYYY-MM-DD'),
              clickedDayOffset: clickedDayOffset, // Keep for logging if needed
              clickedDayMoment: clickedDayMoment.format('YYYY-MM-DD') // Add clicked day moment
            };
            console.log('[ThreeMonthGrid] onDragStart - dragPayload:', dragPayload);
            try { e.dataTransfer.setData('text/plain', JSON.stringify(dragPayload)); e.dataTransfer.effectAllowed = 'move'; } catch (error) { console.error("Erreur setData:", error, dragPayload); }
          }}
          onClick={(e) => {
            if (wasResizingJustNow.current) {
              wasResizingJustNow.current = false; // Réinitialiser le drapeau et ignorer ce clic
              return;
            }
            if (onEditIntervention) onEditIntervention(interventionData.raw);
          }}
        >
          <div style={{ position: 'absolute', left: '5px', top: '2px', whiteSpace: 'nowrap', zIndex: 1, pointerEvents: 'none', color: cellDynamicStyle.color, textShadow: cellDynamicStyle.textShadow }}> {/* zIndex: 1 relatif au td (qui a zIndex 6) */}
            {interventionData.raw?.nom || 'Intervention'}
          </div>
          <div className="resize-handle resize-handle-left" onMouseDown={(e) => handleResizeStart(e, interventionData, 'left')} style={{ position: 'absolute', left: '0px', top: '0px', bottom: '0px', width: '8px', cursor: 'ew-resize', zIndex: 10 }} />
          <div className="resize-handle resize-handle-right" onMouseDown={(e) => handleResizeStart(e, interventionData, 'right')} style={{ position: 'absolute', right: '0px', top: '0px', bottom: '0px', width: '8px', cursor: 'ew-resize', zIndex: 10 }} />
          <div className="link-handle link-handle-start" data-intervention-id={interventionData.id} data-link-type="start" style={{ position: 'absolute', left: '-5px', top: '50%', transform: 'translateY(-50%)', width: '10px', height: '10px', backgroundColor: 'dodgerblue', borderRadius: '50%', cursor: 'crosshair', zIndex: 11, border: '1px solid white' }} draggable onDragStart={(e) => handleLinkDragStart(e, interventionData, 'start')} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleLinkDropOnHandle(e, interventionData, 'start')} />
          <div className="link-handle link-handle-end" data-intervention-id={interventionData.id} data-link-type="end" style={{ position: 'absolute', right: '-5px', top: '50%', transform: 'translateY(-50%)', width: '10px', height: '10px', backgroundColor: 'dodgerblue', borderRadius: '50%', cursor: 'crosshair', zIndex: 11, border: '1px solid white' }} draggable onDragStart={(e) => handleLinkDragStart(e, interventionData, 'end')} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleLinkDropOnHandle(e, interventionData, 'end')} />
        </td>
      );
    }
    return null;
  };

  const handlePrint = () => {
    window.print();
  };

  const projectNamesForPrint = useMemo(() => {
    if (!projets || projets.length === 0) return "";
    return projets.map(p => p.nom).join(', ');
  }, [projets]);

  return (
    <div className="three-month-grid" style={{ position: 'relative' /* Ancre pour le SVG */ }}>
      <div className="print-title">Planning prévisionel: {projectNamesForPrint}</div>
      <div 
        className="print-hide" 
        style={{ 
          display: 'flex', 
          justifyContent: 'flex-start', // Aligne le groupe de boutons de navigation à gauche
          alignItems: 'center', 
          marginBottom: '10px', 
          padding: '5px', 
          position: 'relative' // Nécessaire pour le positionnement absolu du bouton d'impression
        }}
      >
        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          // 370px (largeur col1) - 5px (padding-left du parent) pour aligner avec le début de la 2ème colonne
          marginLeft: 'calc(420px - 5px)' 
        }}> {/* Groupe pour les boutons de navigation de mois */}
          <button onClick={onPreviousMonth} style={{ padding: '8px 12px', cursor: 'pointer' }}>&lt; Mois Précédent</button>
          <button onClick={onNextMonth} style={{ padding: '8px 12px', cursor: 'pointer' }}>Mois Suivant &gt;</button>
        </div>
        <div style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)' }}> {/* Conteneur pour le bouton d'impression, positionné à droite */}
          <button onClick={handlePrint} style={{ padding: '8px 12px', cursor: 'pointer' }}>Imprimer / Enregistrer PDF</button>
        </div>
      </div>
      <svg
        ref={svgDrawingLayerRef}
        style={{
          position: 'absolute',
          top: svgOverlayPosition.top,
          left: svgOverlayPosition.left,
          width: svgOverlayPosition.width,
          height: svgOverlayPosition.height,
          pointerEvents: 'none',
          zIndex: 5,
        }}
      >
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="blue" />
          </marker>
        </defs>
      </svg>
      <table ref={tableRef} className={isLinking ? 'grid-is-linking' : ''} style={{ borderCollapse: 'collapse', tableLayout: 'auto' /* width: '100%' supprimé */ }}>
        <colgroup>
          <col style={{ width: '370px', minWidth: '200px', maxWidth: '450px' }} /> {/* Colonne Projets/Lots */}
          <col style={{ width: '330px', minWidth: '180px', maxWidth: '420px' }} /> {/* Colonne Noms d'intervention */}
          {daysRange.map((_, index) => <col key={`col-day-${index}`} style={{ width: dayHeaderStyle.width }} />)}
        </colgroup>
        <thead ref={theadRef}>
          <tr>
            <th style={commonHeaderCellStyle} colSpan="2"></th>
            {months.map((m, i) => <th key={`month-${i}`} colSpan={m.count} style={monthHeaderStyle}>{m.label}</th>)}
          </tr>
          <tr>
            <th style={commonHeaderCellStyle} colSpan="2"></th>
            {weeks.map((w, i) => <th key={`week-${i}`} colSpan={w.count} style={weekHeaderStyle}>S{w.week}</th>)}
          </tr>
          <tr>
            <th style={{ ...commonHeaderCellStyle, padding: '5px' }} colSpan="2">Projets / Lots / Interventions</th>
            {daysRange.map((d, i) => {
              const isSpecial = !isLoadingSpecialDays && (checkIsPublicHoliday(d) || checkIsSchoolVacationZoneB(d));
              return <th key={`day-${i}`} style={isSpecial ? { ...dayHeaderStyle, ...holidayCellStyle } : dayHeaderStyle} data-date={d.format('YYYY-MM-DD')}><div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onDragOver={handleDragOverCell} onDrop={(e) => handleDropCell(e, d.format('YYYY-MM-DD'))}>{d.format('DD')}</div></th>;
            })}
          </tr>
        </thead>
        <tbody>
          {projets.filter(projet => !!expandedProjetsState[projet.id]).map((projet) => {
            const areProjectLotsVisibleInGrid = !!projectLotsVisibilityState[projet.id];
            return (
              <React.Fragment key={`projet-fragment-${projet.id}`}>
                <tr className="project-row">
                  <td style={projectHeaderStyle} colSpan={areProjectLotsVisibleInGrid ? 2 : 1}>
                    <span onClick={() => onToggleProjectLotsVisibility(projet.id)} style={{ cursor: 'pointer', marginRight: '5px', userSelect: 'none' }}>{areProjectLotsVisibleInGrid ? '▼' : '▶'}</span>
                    <span onClick={() => onEditProjet && onEditProjet(projet)} style={{ cursor: 'pointer' }} title={`Modifier ${projet.nom}`}>{projet.nom}</span>
                  </td>
                  {!areProjectLotsVisibleInGrid && <td style={{...projectDayCellStyle, backgroundColor: projectHeaderStyle.backgroundColor, borderTop: projectHeaderStyle.borderTop, borderBottom: projectHeaderStyle.borderBottom }}></td>}
                  {daysRange.map((day, dayIndex) => {
                    if (!areProjectLotsVisibleInGrid) return renderCompiledProjectDayCell(projet, day, dayIndex);
                    const isSpecial = !isLoadingSpecialDays && (checkIsPublicHoliday(day) || checkIsSchoolVacationZoneB(day));
                    const cellStyle = isSpecial ? { ...projectDayCellStyle, ...holidayCellStyle, borderTop: projectHeaderStyle.borderTop, borderBottom: projectHeaderStyle.borderBottom } : { ...projectDayCellStyle, borderTop: projectHeaderStyle.borderTop, borderBottom: projectHeaderStyle.borderBottom };
                    return <td key={`proj-day-${projet.id}-${dayIndex}`} style={cellStyle} data-date={day.format('YYYY-MM-DD')} onDragOver={handleDragOverCell} onDrop={(e) => handleDropCell(e, day.format('YYYY-MM-DD'))}></td>;
                  })}
                </tr>
                {areProjectLotsVisibleInGrid && (projet.lots || []).map(lot => {
                  const areLotInterventionsVisible = !!expandedLotInterventionsState[lot.id];
                  const lotInterventionsForThisLot = interventions
                    .filter(iv => iv.lot_id === lot.id)
                    .map(iv => ({ ...iv, id: iv.id, raw: iv, start: moment(iv.date), end: moment(iv.date_fin || iv.date) }))
                    .filter(ivData => ivData.start.isValid() && ivData.end.isValid())
                    .sort((a, b) => { // Tri pour stabiliser l'ordre
                        if (a.start.isBefore(b.start)) return -1;
                        if (a.start.isAfter(b.start)) return 1;
                        if (a.id < b.id) return -1;
                        if (a.id > b.id) return 1;
                        return 0;
                    });
                  const lotNameCellRowSpan = (areLotInterventionsVisible && lotInterventionsForThisLot.length > 0) ? lotInterventionsForThisLot.length : 1;
                  const firstInterventionData = lotInterventionsForThisLot[0];
                  return (
                    <React.Fragment key={`lot-fragment-${lot.id}`}>
                      <tr className="lot-row">
                        <td style={lotHeaderStyle} rowSpan={lotNameCellRowSpan}>
                          <span onClick={() => onToggleLotInterventions(lot.id)} style={{ cursor: 'pointer', marginRight: '5px', userSelect: 'none' }}>{areLotInterventionsVisible ? '▼' : '▶'}</span>
                          <span onClick={() => onEditLot && onEditLot(lot)} style={{ cursor: 'pointer' }} title={`Modifier ${lot.nom}`}>{lot.nom}</span>
                        </td>
                        {!areLotInterventionsVisible ? (
                          <>
                            <td style={{...interventionNameStyle, backgroundColor: lotHeaderStyle.backgroundColor, borderTop: lotHeaderStyle.borderTop, borderBottom: lotHeaderStyle.borderBottom }}></td>
                            {daysRange.map((day, dayIndex) => renderCompiledLotDayCell(lot, day, dayIndex))}
                          </>
                        ) : firstInterventionData ? (
                          <>
                            <td 
                              style={{...interventionNameStyle, borderTop: lotHeaderStyle.borderTop, cursor: 'pointer' }}
                              onClick={() => { if (onEditIntervention) onEditIntervention(firstInterventionData.raw); }}
                              title={`Modifier ${firstInterventionData.raw?.nom || 'Intervention'}`}
                            >• {firstInterventionData.raw?.nom || 'Intervention'}</td>
                            {daysRange.map((_, dayIdx) => renderInterventionCells(firstInterventionData, dayIdx, daysRange, true))}
                          </>
                        ) : (
                          <>
                            <td style={{ ...interventionNameStyle, fontStyle: 'italic', borderTop: lotHeaderStyle.borderTop }}>(Aucune intervention)</td>
                            {daysRange.map((day, dayIndex) => {
                              const isSpecial = !isLoadingSpecialDays && (checkIsPublicHoliday(day) || checkIsSchoolVacationZoneB(day)) ;
                              let cellStyle = isSpecial ? { ...lotRowDayCellStyle, ...holidayCellStyle } : { ...lotRowDayCellStyle };
                              if (isResizing && resizePreviewSpan && day.isBetween(resizePreviewSpan.start, resizePreviewSpan.end, 'day', '[]') && resizingInfo?.lotId === lot.id) {
                                  cellStyle.backgroundColor = 'rgba(0, 100, 255, 0.2)';
                                  cellStyle.outline = '1px dashed rgba(0, 100, 255, 0.5)';
                              }
                              return <td key={`lot-empty-int-day-${lot.id}-${dayIndex}`} style={cellStyle} data-date={day.format('YYYY-MM-DD')} onDragOver={handleDragOverCell} onDrop={(e) => handleDropCell(e, day.format('YYYY-MM-DD'))}></td>;
                            })}
                          </>
                        )}
                      </tr>
                      {areLotInterventionsVisible && lotInterventionsForThisLot.slice(1).map(interventionData => (
                        <tr key={`intervention-row-${interventionData.id}`} className="intervention-row">
                          <td style={interventionNameStyle}>• {interventionData.raw?.nom || 'Intervention'}</td>
                          {daysRange.map((_, dayIdx) => renderInterventionCells(interventionData, dayIdx, daysRange, false))}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {isDeleteLinkModalOpen && linkToDelete && (
        <Modal isOpen={isDeleteLinkModalOpen} onClose={() => handleOpenDeleteLinkModal(null) /* Or a dedicated close function from hook */ }>
          <h3 style={{ marginTop: 0 }}>Supprimer la Liaison ?</h3>
          <p>
            Êtes-vous sûr de vouloir supprimer la liaison entre l'intervention
            "{interventions.find(i => i.id === linkToDelete.source_intervention_id)?.nom || 'Source inconnue'}"
            et "{interventions.find(i => i.id === linkToDelete.target_intervention_id)?.nom || 'Cible inconnue'}" ?
          </p>
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => handleOpenDeleteLinkModal(null) /* Or a dedicated close function from hook */ } style={{ marginRight: '10px' }}>Annuler</button>
            <button onClick={handleDeleteLink} style={{ backgroundColor: 'red', color: 'white' }}>Supprimer</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
