// ThreeMonthGrid.jsx
import React, { useMemo, useLayoutEffect, useEffect, useState, useCallback, useRef } from 'react';
import 'moment/locale/fr';
import moment from 'moment';
import './ThreeMonthGrid.css';
import { generateProjectColors, generateInterventionColors } from './utils/colorUtils';
import { isPublicHoliday, isSchoolVacationZoneB } from './utils/holidays';
import { supabase } from './lib/supabaseClient';
import Modal from './Modal';
import Legend from './Legend';
import { useInterventionLinking } from './hooks/useInterventionLinking';

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
  interventionEtats,
  isLoadingData,
  showLegend,
  showCurrentDayIndicator,
  numberOfMonthsToDisplay = 3 // Ajout d'une nouvelle prop pour le nombre de mois
}) {
  const svgDrawingLayerRef = useRef(null);
  const [currentDayIndicatorStyle, setCurrentDayIndicatorStyle] = useState(null);

  const [isResizing, setIsResizing] = useState(false);
  const [resizingInfo, setResizingInfo] = useState(null);
  const resizingCellRef = useRef(null);
  const [resizePreviewSpan, setResizePreviewSpan] = useState(null);
  const wasResizingJustNow = useRef(false);
  const [svgOverlayPosition, setSvgOverlayPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const theadRef = useRef(null);
  const tableRef = useRef(null);

  const INTERVENTION_CELL_HEIGHT = '28px';
  const INTERVENTION_CELL_VERTICAL_PADDING = '3px';

  const dayHeaderStyle = {
    width: '18px',
    textAlign: 'center',
    padding: `${INTERVENTION_CELL_VERTICAL_PADDING} 0`,
    fontSize: '0.8em',
    borderBottom: '1px solid #999999',
    height: INTERVENTION_CELL_HEIGHT,
    boxSizing: 'border-box',
  };

  const { ETAT_STYLES, getHachuresStyle } = interventionEtats;

  const dayCellStyle = {
    width: dayHeaderStyle.width,
    minWidth: dayHeaderStyle.width,
    maxWidth: dayHeaderStyle.width,
    height: INTERVENTION_CELL_HEIGHT,
    padding: `${INTERVENTION_CELL_VERTICAL_PADDING} 2px`,
    borderLeft: '1px solid #eee', // Laisser border-top et border-bottom être gérés par CSS pour la propagation
    borderRight: '1px solid #eee',
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

  const projectDayCellStyle = {
    ...dayCellStyle,
  };

  const lotRowDayCellStyle = {
    ...dayCellStyle,
  };

  const interventionRowDayCellStyle = {
    ...dayCellStyle,
  };

  const commonHeaderCellStyle = { width: 'auto', backgroundColor: 'white', whiteSpace: 'nowrap' };
  const monthHeaderStyle = { textAlign: 'center', borderBottom: '1px solid #999999', borderTop: '1px solid #999999' };
  const weekHeaderStyle = { textAlign: 'center', borderBottom: '1px solid #999999', fontSize: '0.9em' };

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
  const endDateOfView = useMemo(() => moment(startDateOfView).add(numberOfMonthsToDisplay - 1, 'months').endOf('month'), [startDateOfView, numberOfMonthsToDisplay]);

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

  const adjustToNextBusinessDay = (dateMoment) => {
    let adjustedDate = dateMoment.clone();
    while (adjustedDate.day() === 0 || adjustedDate.day() === 6) {
      adjustedDate.add(1, 'day');
    }
    return adjustedDate;
  };

  const hexToRgb = (hex) => {
    if (!hex) return { r: 128, g: 128, b: 128 };
    let c;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
      c = hex.substring(1).split('');
      if (c.length === 3) {
        c = [c[0], c[0], c[1], c[1], c[2], c[2]];
      }
      c = '0x' + c.join('');
      return { r: (c >> 16) & 255, g: (c >> 8) & 255, b: c & 255 };
    }
    console.warn(`Invalid hex color for hexToRgb: ${hex}`);
    return { r: 128, g: 128, b: 128 };
  };

  // Fonction pour obtenir une version assombrie d'une couleur hexadécimale
  const getDarkerRgbString = (hex, percent) => { // percent est 0-1, ex: 0.3 pour 30% plus sombre
    if (!hex) return 'rgb(85, 85, 85)'; // Gris foncé par défaut si hex est invalide
    let { r, g, b } = hexToRgb(hex); // hexToRgb est déjà défini dans ce composant
    r = Math.max(0, Math.floor(r * (1 - percent)));
    g = Math.max(0, Math.floor(g * (1 - percent)));
    b = Math.max(0, Math.floor(b * (1 - percent)));
    return `rgb(${r}, ${g}, ${b})`;
  };

  const handleToggleInterventionVisibility = async (interventionRaw) => {
    if (!interventionRaw || interventionRaw.id === undefined) return;

    const newVisibility = !(interventionRaw.visible_sur_planning !== undefined ? interventionRaw.visible_sur_planning : true);

    const { error } = await supabase
      .from('interventions')
      .update({ visible_sur_planning: newVisibility })
      .eq('id', interventionRaw.id);

    if (error) {
      console.error("Erreur lors de la mise à jour de la visibilité de l'intervention:", error);
    }
    onInterventionUpdated();
  };

  const handleResizeStart = useCallback((e, interventionData, direction) => {
    e.preventDefault();
    e.stopPropagation();
    wasResizingJustNow.current = true;

    setIsResizing(true);
    setResizingInfo({
      interventionId: interventionData.id,
      originalStart: interventionData.start.clone(),
      originalEnd: interventionData.end.clone(),
      direction: direction,
      lotId: interventionData.raw.lot_id
    });
    resizingCellRef.current = e.currentTarget.closest('td');
  }, [setIsResizing, setResizingInfo, resizingCellRef]);

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
    const clickedDayMoment = moment(dragData.clickedDayMoment);
    const dropTargetDate = moment(newDate);

    const dateDifference = dropTargetDate.diff(clickedDayMoment, 'days');
    let newDebMomentForDragged = originalStartMomentForDragged.clone().add(dateDifference, 'days');

    newDebMomentForDragged = adjustToNextBusinessDay(newDebMomentForDragged);

    const businessDayDurationForDragged = calculateBusinessDaysDuration(originalStartMomentForDragged, originalEndMomentForDragged);
    const newFinMomentForDragged = addBusinessDays(newDebMomentForDragged, businessDayDurationForDragged > 0 ? businessDayDurationForDragged : 1);

    const newDebForDraggedStr = newDebMomentForDragged.format('YYYY-MM-DD');
    const newFinForDraggedStr = newFinMomentForDragged.format('YYYY-MM-DD');

    console.log(`[handleDrop] Vérification des dates. Original Start: ${originalStartMomentForDragged.format('YYYY-MM-DD')}, Original End: ${originalEndMomentForDragged.format('YYYY-MM-DD')}`);
    console.log(`[handleDrop] Vérification des dates. Calculated New Start: ${newDebForDraggedStr}, Calculated New End: ${newFinForDraggedStr}`);

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

            let originalGapDays = 0;
            const originalSourceStartMoment = moment(currentSourceOriginal.date);
            const originalSourceEndMoment = moment(currentSourceOriginal.date_fin || currentSourceOriginal.date);

            if (link.link_type === 'finish-to-start') {
                 originalGapDays = originalTargetStartMoment.diff(originalSourceEndMoment, 'days');
            } else if (link.link_type === 'start-to-start') {
                 originalGapDays = originalTargetStartMoment.diff(originalSourceStartMoment, 'days');
            }

            let newTargetDebTheoreticalMoment;
            if (link.link_type === 'finish-to-start') {
                newTargetDebTheoreticalMoment = moment(currentSourceUpdatedData.date_fin).add(originalGapDays, 'days');
            } else {
                newTargetDebTheoreticalMoment = moment(currentSourceUpdatedData.date).add(originalGapDays, 'days');
            }
            let newTargetDebMoment = adjustToNextBusinessDay(newTargetDebTheoreticalMoment);
            const newTargetFinMoment = addBusinessDays(newTargetDebMoment, targetBusinessDayDuration > 0 ? targetBusinessDayDuration : 1);

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
        queue.push(resizedInterventionId);

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

                let originalGapDays = 0;
                const originalSourceStartMoment = moment(originalSourceIntervention.date);
                const originalSourceEndMoment = moment(originalSourceIntervention.date_fin || originalSourceIntervention.date);

                if (link.link_type === 'finish-to-start') {
                     originalGapDays = originalTargetStartMoment.diff(originalSourceEndMoment, 'days');
                } else if (link.link_type === 'start-to-start') {
                     originalGapDays = originalTargetStartMoment.diff(originalSourceStartMoment, 'days');
                }

                let newTargetDebTheoreticalMoment;
                if (link.link_type === 'finish-to-start') {
                    newTargetDebTheoreticalMoment = currentSourceNewEndMoment.clone().add(originalGapDays, 'days');
                } else {
                    newTargetDebTheoreticalMoment = currentSourceNewStartMoment.clone().add(originalGapDays, 'days');
                }
                let newTargetDebMoment = adjustToNextBusinessDay(newTargetDebTheoreticalMoment);

                const newTargetFinMoment = addBusinessDays(newTargetDebMoment, targetBusinessDayDuration > 0 ? targetBusinessDayDuration : 1);

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
    if (tableRef.current && theadRef.current) {
      const theadHeight = theadRef.current.offsetHeight;
      console.log('[SVG Layout] theadRef.current.offsetHeight:', theadHeight);

      console.log('[SVG Layout] tableRef.current.offsetTop:', tableRef.current.offsetTop);
      console.log('[SVG Layout] tableRef.current.offsetLeft:', tableRef.current.offsetLeft);
      console.log('[SVG Layout] tableRef.current.offsetWidth:', tableRef.current.offsetWidth);
      console.log('[SVG Layout] tableRef.current.offsetHeight:', tableRef.current.offsetHeight);
      const tableRectForLayout = tableRef.current.getBoundingClientRect();
      console.log('[SVG Layout] tableRef.current.getBoundingClientRect():', { top: tableRectForLayout.top, left: tableRectForLayout.left, width: tableRectForLayout.width, height: tableRectForLayout.height });
      const newPosition = {
        top: tableRef.current.offsetTop + theadHeight,
        left: tableRef.current.offsetLeft,
        width: tableRef.current.offsetWidth,
        height: tableRef.current.offsetHeight - theadHeight,
      };

      if (newPosition.width <= 0 || newPosition.height < 10) { 
        if (tableRef.current && (tableRef.current.offsetWidth > 0 || tableRef.current.offsetHeight > 10)) {
            console.warn(`[SVG Layout] Calculated SVG dimensions are not valid (w:${newPosition.width}, h:${newPosition.height}). Deferring update. theadHeight: ${theadHeight}, tableWidth: ${tableRef.current.offsetWidth}, tableHeight: ${tableRef.current.offsetHeight}`);
        }
        return;
      }

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
  }, [projets, interventions, links, daysRange, expandedProjetsState, projectLotsVisibilityState, expandedLotInterventionsState, isLoadingData, svgOverlayPosition.top, svgOverlayPosition.left, svgOverlayPosition.width, svgOverlayPosition.height, theadRef.current?.offsetHeight]);

  useEffect(() => {
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
  }, [links, interventions, expandedProjetsState, projectLotsVisibilityState, expandedLotInterventionsState, isLoadingData, svgOverlayPosition, drawPermanentLinks]);

  useEffect(() => {
    if (showCurrentDayIndicator && tableRef.current && theadRef.current && daysRange.length > 0 && !isLoadingData) {
      const today = moment();
      const dayHeaderCells = Array.from(theadRef.current.querySelectorAll('tr:last-child th[data-date]'));
      const currentDayHeaderCell = dayHeaderCells.find(th => {
        const dateStr = th.dataset.date;
        return moment(dateStr).isSame(today, 'day');
      });

      if (currentDayHeaderCell && tableRef.current.offsetParent) {
        const tableContainerRect = tableRef.current.offsetParent.getBoundingClientRect();
        const cellRect = currentDayHeaderCell.getBoundingClientRect();
        const tableBodyTop = tableRef.current.offsetTop + theadRef.current.offsetHeight;
        const tableBodyHeight = tableRef.current.offsetHeight - theadRef.current.offsetHeight;

        const indicatorLeft = cellRect.left - tableContainerRect.left;

        setCurrentDayIndicatorStyle({
          position: 'absolute',
          top: `${tableBodyTop}px`,
          left: `${indicatorLeft}px`,
          width: '0px',
          height: `${tableBodyHeight}px`,
          borderLeft: '2px dashed red',
          pointerEvents: 'none',
          zIndex: 5,
        });
      } else {
        setCurrentDayIndicatorStyle(null);
      }
    } else {
      setCurrentDayIndicatorStyle(null);
    }
  }, [showCurrentDayIndicator, daysRange, svgOverlayPosition, isLoadingData, tableRef, theadRef]);

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
    const projectInterventions = interventions.filter(iv => 
      projet.lots?.some(l => l.id === iv.lot_id) && 
      (iv.visible_sur_planning !== false)
    );
    const isActuallyActive = projectInterventions.some(iv => isInterventionActiveOnDay(iv, day));
    const dayIndex = keySuffix; // keySuffix est l'index du jour dans daysRange
    const isLastDayOfWeek = (dayIndex === daysRange.length - 1) ||
                            (dayIndex < daysRange.length - 1 && day.isoWeek() !== daysRange[dayIndex + 1].isoWeek());
    const isSpecial = !isLoadingSpecialDays && (checkIsPublicHoliday(day) || checkIsSchoolVacationZoneB(day));
    
    let cellStyle = { ...projectDayCellStyle, opacity: isActuallyActive ? 0.7 : 1 };
    let cellClassName = 'day-cell-base project-day-cell';

    if (isActuallyActive) {
      cellStyle.backgroundColor = projet.color || '#e0e0e0';
    } else if (isSpecial) {
      cellClassName += ' holiday-vacation';
    }
    if (isLastDayOfWeek) cellClassName += ' day-cell-week-end';

    return (
      <td 
        key={`compiled-proj-${projet.id}-day-${keySuffix}`} 
        style={cellStyle} 
        className={cellClassName}
        data-date={day.format('YYYY-MM-DD')} 
        onDragOver={handleDragOverCell} 
        onDrop={(e) => handleDropCell(e, day.format('YYYY-MM-DD'))}
      />
    );
  };

  const renderCompiledLotDayCell = (lot, day, keySuffix) => {
    const lotInterventions = interventions.filter(iv => 
      iv.lot_id === lot.id && 
      (iv.visible_sur_planning !== false)
    );
    const isActuallyActive = lotInterventions.some(iv => isInterventionActiveOnDay(iv, day));
    let lotDisplayColor = lot.color || projets.find(p => p.id === lot.projet_id)?.color || '#d0d0d0';
    const dayIndex = keySuffix; // keySuffix est l'index du jour dans daysRange
    const isLastDayOfWeek = (dayIndex === daysRange.length - 1) ||
                            (dayIndex < daysRange.length - 1 && day.isoWeek() !== daysRange[dayIndex + 1].isoWeek());
    const isSpecial = !isLoadingSpecialDays && (checkIsPublicHoliday(day) || checkIsSchoolVacationZoneB(day));
    
    let cellStyle = { ...lotRowDayCellStyle };
    let cellClassName = 'day-cell-base lot-row-day-cell';
    let cellContent = null;

    if (isSpecial && !isActuallyActive) cellClassName += ' holiday-vacation';
    if (isActuallyActive) {
      const { r, g, b } = hexToRgb(lotDisplayColor);
      const lotDisplayRgbaColorWithOpacity = `rgba(${r}, ${g}, ${b}, 0.6)`;

      cellStyle.backgroundColor = lotDisplayRgbaColorWithOpacity;

      if (dayIndex > 0) {
        const prevDay = daysRange[dayIndex - 1];
        const isPrevDayActive = lotInterventions.some(iv => isInterventionActiveOnDay(iv, prevDay));
        if (isPrevDayActive) {
          cellStyle.borderLeftColor = lotDisplayRgbaColorWithOpacity;
        }
      }
      if (dayIndex < daysRange.length - 1) {
        const nextDay = daysRange[dayIndex + 1];
        const isNextDayActive = lotInterventions.some(iv => isInterventionActiveOnDay(iv, nextDay));
        if (isNextDayActive) {
          cellStyle.borderRightColor = lotDisplayRgbaColorWithOpacity;
        }
      }

      const isFirstActiveCellInLotDisplay = (dayIndex === 0) || 
                                          (dayIndex > 0 && !lotInterventions.some(iv => isInterventionActiveOnDay(iv, daysRange[dayIndex - 1])));
      
      if (isFirstActiveCellInLotDisplay) {
        cellStyle.position = 'relative';
        cellStyle.overflow = 'visible';
        cellContent = (
          <div style={{
            position: 'absolute',
            left: '3px',
            top: '50%',
            transform: 'translateY(-50%)',
            whiteSpace: 'nowrap',
            color: 'white',
            fontSize: '0.8em',
            fontWeight: 'bold',
            textShadow: '0 0 2px rgba(0,0,0,0.7), 0 0 1px rgba(0,0,0,0.7)',
            pointerEvents: 'none',
            zIndex: 1,
          }}>
            {lot.nom}
          </div>
        );
      }
    }
    if (isLastDayOfWeek) cellClassName += ' day-cell-week-end';

    return (
      <td 
        key={`compiled-lot-${lot.id}-day-${keySuffix}`} 
        style={cellStyle} 
        className={cellClassName}
        data-date={day.format('YYYY-MM-DD')} 
        onDragOver={handleDragOverCell} 
        onDrop={(e) => handleDropCell(e, day.format('YYYY-MM-DD'))}
      >
        {cellContent}
      </td>
    );
  };

  const renderInterventionCells = (interventionData, dayIndexInDaysRange, allVisibleDaysInRange, isFirstInterventionInLot) => {
    if (interventionData.raw?.visible_sur_planning === false) {
      const currentVisibleDayForHidden = allVisibleDaysInRange[dayIndexInDaysRange];
      const isLastDayOfWeekForHidden = (dayIndexInDaysRange === allVisibleDaysInRange.length - 1) ||
                                   (dayIndexInDaysRange < allVisibleDaysInRange.length - 1 && currentVisibleDayForHidden.isoWeek() !== allVisibleDaysInRange[dayIndexInDaysRange + 1].isoWeek());
      const isSpecialForHidden = !isLoadingSpecialDays && (checkIsPublicHoliday(currentVisibleDayForHidden) || checkIsSchoolVacationZoneB(currentVisibleDayForHidden));
      const baseDayCellClass = isFirstInterventionInLot ? 'lot-row-day-cell' : 'intervention-row-day-cell';
      let cellClassName = `day-cell-base ${baseDayCellClass}`;
      if (isSpecialForHidden) cellClassName += ' holiday-vacation';
      if (isLastDayOfWeekForHidden) cellClassName += ' day-cell-week-end';
      
      return (
        <td 
          key={`hidden-int-${interventionData.id}-${dayIndexInDaysRange}`} 
          className={cellClassName}
          data-date={currentVisibleDayForHidden.format('YYYY-MM-DD')} 
          onDragOver={handleDragOverCell} 
          onDrop={(e) => handleDropCell(e, currentVisibleDayForHidden.format('YYYY-MM-DD'))}
        />
      );
    }

    const currentVisibleDay = allVisibleDaysInRange[dayIndexInDaysRange];
    const isLastDayOfWeek = (dayIndexInDaysRange === allVisibleDaysInRange.length - 1) ||
                            (dayIndexInDaysRange < allVisibleDaysInRange.length - 1 && currentVisibleDay.isoWeek() !== allVisibleDaysInRange[dayIndexInDaysRange + 1].isoWeek());
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
      const baseDayCellClass = isFirstInterventionInLot ? 'lot-row-day-cell' : 'intervention-row-day-cell';
      let cellClassName = `day-cell-base ${baseDayCellClass}`;
      if (isSpecial) cellClassName += ' holiday-vacation';
      if (isLastDayOfWeek) cellClassName += ' day-cell-week-end';
      
      return (
        <td 
          key={`invalid-int-${interventionData.id}-${dayIndexInDaysRange}`} 
          className={cellClassName}
        >
          Date Invalide
        </td>
      );
    }

    const isCurrentDayInDisplaySpan = currentVisibleDay.isBetween(displayStartMoment, displayEndMoment, 'day', '[]');
    if (!isCurrentDayInDisplaySpan) {
      const baseDayCellClass = isFirstInterventionInLot ? 'lot-row-day-cell' : 'intervention-row-day-cell';
      let cellClassName = `day-cell-base ${baseDayCellClass}`;
      if (isSpecial) cellClassName += ' holiday-vacation';
      if (isLastDayOfWeek) cellClassName += ' day-cell-week-end';
      
      return (
        <td 
          key={`empty-for-${interventionData.id}-day-${dayIndexInDaysRange}`} 
          data-date={currentVisibleDay.format('YYYY-MM-DD')} 
          onDragOver={handleDragOverCell} 
          onDrop={(e) => handleDropCell(e, currentVisibleDay.format('YYYY-MM-DD'))} 
          style={baseCellStyleForIntervention}
          className={cellClassName}
        />
      );
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
         const baseDayCellClass = isFirstInterventionInLot ? 'lot-row-day-cell' : 'intervention-row-day-cell';
         let cellClassName = `day-cell-base ${baseDayCellClass}`;
         if (isSpecial) cellClassName += ' holiday-vacation';
         if (isLastDayOfWeek) cellClassName += ' day-cell-week-end';
         let cellStyle = {};
         if (applyPreviewStyleToMainBlock) { 
           cellStyle.backgroundColor = 'rgba(136, 136, 136, 0.2)'; 
           cellStyle.outline = '1px dashed rgba(165, 165, 165, 0.5)';
         }
         
         return (
           <td 
             key={`zero-colspan-int-${interventionData.id}-${dayIndexInDaysRange}`} 
             style={cellStyle} 
             className={cellClassName}
             data-date={currentVisibleDay.format('YYYY-MM-DD')} 
             onDragOver={handleDragOverCell} 
             onDrop={(e) => handleDropCell(e, currentVisibleDay.format('YYYY-MM-DD'))}
           />
         );
      }

      const originalColor = colorMap[interventionData.id] || '#66aaff';
      // Styles pour le DIV interne qui représente le bloc d'intervention
      let innerDivDynamicStyle = {
        position: 'relative',
        zIndex: 6,
        backgroundColor: originalColor,
        color: 'white',
        overflow: 'visible',
        padding: `${INTERVENTION_CELL_VERTICAL_PADDING} 5px`, // Padding original du bloc
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
      };

      const etatIntervention = interventionData.raw?.etat;
      const styleInfo = etatIntervention ? ETAT_STYLES[etatIntervention] : null;

      let finalBorderWidth, finalBorderStyle, finalBorderColor;

      if (styleInfo) {
        // Cas 1: L'intervention a un état reconnu dans ETAT_STYLES
        finalBorderWidth = styleInfo.borderWidth || '2px';
        finalBorderStyle = styleInfo.borderStyle || 'solid';

        if (styleInfo.borderColor) {
          finalBorderColor = styleInfo.borderColor;
        } else {
          // ETAT_STYLES existe pour cet état, mais borderColor n'est pas spécifié.
          // Utiliser une version assombrie de la couleur de base de l'intervention.
          finalBorderColor = getDarkerRgbString(originalColor, 0.4); // Assombrir de 40%
        }

        // Appliquer l'opacité du fond et les hachures si définis dans styleInfo
        const { r, g, b } = hexToRgb(originalColor);
        innerDivDynamicStyle.backgroundColor = `rgba(${r}, ${g}, ${b}, ${styleInfo.backgroundOpacity})`;

        if (styleInfo.hachures) {
          const hachuresCss = getHachuresStyle(originalColor, 0.3);
          innerDivDynamicStyle.backgroundImage = hachuresCss.backgroundImage;
        }
      } else {
        // Cas 2: L'intervention n'a pas d'état reconnu (ou etat est null)
        // Appliquer une bordure par défaut. Le fond reste originalColor.
        finalBorderWidth = '1px';
        finalBorderStyle = 'solid';
        finalBorderColor = '#7d7d7d'; // Gris un peu plus foncé pour la bordure par défaut
      }
      
      innerDivDynamicStyle.borderTop = `${finalBorderWidth} ${finalBorderStyle} ${finalBorderColor}`;
      innerDivDynamicStyle.borderRight = `${finalBorderWidth} ${finalBorderStyle} ${finalBorderColor}`;
      innerDivDynamicStyle.borderBottom = `${finalBorderWidth} ${finalBorderStyle} ${finalBorderColor}`;
      innerDivDynamicStyle.borderLeft = `${finalBorderWidth} ${finalBorderStyle} ${finalBorderColor}`;

      if (applyPreviewStyleToMainBlock) {
        // Styles de prévisualisation pour le div interne
        innerDivDynamicStyle = {
          ...innerDivDynamicStyle,
          backgroundColor: 'rgba(182, 182, 182, 0.3)', 
          outline: '2px dashed rgba(112, 112, 112, 0.7)', 
          outlineOffset: '-2px', 
          color: 'rgba(0,0,0,0.6)', 
          textShadow: 'none', 
          // Conserver les bordures calculées pour la prévisualisation aussi
          borderTop: innerDivDynamicStyle.borderTop,
          borderRight: innerDivDynamicStyle.borderRight,
          borderBottom: innerDivDynamicStyle.borderBottom,
          borderLeft: innerDivDynamicStyle.borderLeft,
        };
      }

      // Classes pour la cellule TD conteneur
      const tdContainerBaseClass = isFirstInterventionInLot ? 'lot-row-day-cell' : 'intervention-row-day-cell';
      let tdContainerClassName = `intervention-block-container-td day-cell-base ${tdContainerBaseClass}`;
      if (isSpecial) tdContainerClassName += ' holiday-vacation';
      if (isLastDayOfWeek) tdContainerClassName += ' day-cell-week-end';
      
      // Style pour la cellule TD conteneur
      const tdContainerStyle = {
        padding: 0, // Important pour que le div interne remplisse la cellule
        // border: 'none', // Retiré pour permettre aux bordures de la grille de s'appliquer
        verticalAlign: 'middle', // Assurer l'alignement vertical
      };

      return (
        <td
          key={`int-block-${interventionData.id}-${dayIndexInDaysRange}`}
          className={tdContainerClassName}
          data-date={displayStartMoment.format('YYYY-MM-DD')} 
          onDragOver={handleDragOverCell}
          onDrop={(e) => {
            const actualTargetDateCell = findDateCellByPoint(e.clientX, e.clientY, tableRef.current);
            const dropDate = actualTargetDateCell?.dataset.date || displayStartMoment.format('YYYY-MM-DD');
            handleDropCell(e, dropDate);
          }} 
          colSpan={colSpan} 
          style={tdContainerStyle}
        >
          <div 
            className="intervention-block-base" // Appliquer la classe de base au div interne
            style={innerDivDynamicStyle}
            draggable
            onDragStart={(e) => {
              // Le onDragStart est maintenant sur le div interne.
              // S'assurer que e.currentTarget est bien ce div pour les calculs de position.
              const divElement = e.currentTarget;
              const rect = divElement.getBoundingClientRect();
              const clickXRelativeToCell = e.clientX - rect.left;
              // La largeur de colonne de jour est toujours pertinente pour déterminer sur quel "jour" du bloc on a cliqué.
              const dayColumnWidth = parseInt(dayHeaderStyle.width, 10) || 18;
              const dayIndexWithinRenderedBlock = (dayColumnWidth > 0) ? Math.floor(clickXRelativeToCell / dayColumnWidth) : 0;
              const firstDayOfRenderedBlockInGrid = daysRange[dayIndexInDaysRange]; // Date de début de la cellule TD
              const clickedDayMoment = firstDayOfRenderedBlockInGrid.clone().add(dayIndexWithinRenderedBlock, 'days');
              const clickedDayOffset = clickedDayMoment.diff(actualInterventionStart, 'days');

              const dragPayload = {
                id: interventionData.id,
                date: actualInterventionStart.format('YYYY-MM-DD'),
                date_fin: actualInterventionEnd.format('YYYY-MM-DD'),
                clickedDayOffset: clickedDayOffset,
                clickedDayMoment: clickedDayMoment.format('YYYY-MM-DD')
              };
              try { 
                e.dataTransfer.setData('text/plain', JSON.stringify(dragPayload)); 
                e.dataTransfer.effectAllowed = 'move'; 
              } catch (error) { 
                console.error("Erreur setData:", error, dragPayload); 
              }
            }}
            onClick={(e) => {
              if (wasResizingJustNow.current) {
                wasResizingJustNow.current = false;
                return;
              }
              if (onEditIntervention) onEditIntervention(interventionData.raw);
            }}
          >
            {(() => {
              const nameStyle = {
                position: 'absolute',
                left: '5px', // Correspond au padding gauche du parent (innerDivDynamicStyle)
                top: '50%',
                // Retrait de right: '5px', overflow: 'hidden', text-overflow: 'ellipsis'
                // pour permettre au texte de déborder.
                transform: 'translateY(-50%)',
                whiteSpace: 'nowrap',
                zIndex: 1, // Au-dessus du fond du div interne, mais sous les poignées
                pointerEvents: 'none',
                color: innerDivDynamicStyle.color,
              };
              if (innerDivDynamicStyle.textShadow !== undefined) {
                // Appliquer le textShadow dynamique (par ex. 'none' pour les aperçus)
                nameStyle.textShadow = innerDivDynamicStyle.textShadow;
              } else {
                // Appliquer une bordure grise par défaut au texte
                nameStyle.textShadow = `
                  -1px -1px 0 #888, 1px -1px 0 #888, -1px 1px 0 #888, 1px 1px 0 #888,
                  0 1px 2px rgba(0, 0, 0, 0.3) 
                `; // La dernière ligne est l'ombre douce originale, si vous voulez la conserver en plus de la bordure
              }
              return <div style={nameStyle}>{interventionData.raw?.nom || 'Intervention'}</div>;
            })()}
            <div 
              className="resize-handle resize-handle-left" 
              onMouseDown={(e) => handleResizeStart(e, interventionData, 'left')} 
            />
            <div 
              className="resize-handle resize-handle-right" 
              onMouseDown={(e) => handleResizeStart(e, interventionData, 'right')} 
            />
            <div 
              className="link-handle link-handle-start" 
              data-intervention-id={interventionData.id} 
              data-link-type="start" 
              draggable 
              onDragStart={(e) => handleLinkDragStart(e, interventionData, 'start')} 
              onDragOver={(e) => e.preventDefault()} 
              onDrop={(e) => handleLinkDropOnHandle(e, interventionData, 'start')} 
            />
            <div 
              className="link-handle link-handle-end" 
              data-intervention-id={interventionData.id} 
              data-link-type="end" 
              draggable 
              onDragStart={(e) => handleLinkDragStart(e, interventionData, 'end')} 
              onDragOver={(e) => e.preventDefault()} 
              onDrop={(e) => handleLinkDropOnHandle(e, interventionData, 'end')} 
            />
          </div>
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
    // Filtrer pour n'inclure que les noms des projets actuellement visibles/développés dans le tableau
    const visibleProjectNames = projets.filter(p => !!expandedProjetsState[p.id]).map(p => p.nom);
    return visibleProjectNames.join(', ');
  }, [projets, expandedProjetsState]);

  return (
    <div className="three-month-grid">
      {currentDayIndicatorStyle && <div style={currentDayIndicatorStyle} data-testid="current-day-indicator" />}
      <div className="print-title">Planning estimatif prévisionel : {projectNamesForPrint}</div>
      <div 
        className="print-hide" 
        style={{ 
          display: 'flex', 
          justifyContent: 'flex-start',
          alignItems: 'center', 
          marginBottom: '10px', 
          padding: '5px', 
          position: 'relative'
        }}
      >
        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          marginLeft: 'calc(420px - 5px)' 
        }}>
          <button onClick={onPreviousMonth} style={{ padding: '8px 12px', cursor: 'pointer' }}>&lt; Mois Précédent</button>
          <button onClick={onNextMonth} style={{ padding: '8px 12px', cursor: 'pointer' }}>Mois Suivant &gt;</button>
        </div>
        <div style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)' }}>
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
        width={svgOverlayPosition.width > 0 ? svgOverlayPosition.width : undefined}
        height={svgOverlayPosition.height > 0 ? svgOverlayPosition.height : undefined}
      >
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="blue" />
          </marker>
        </defs>
      </svg>
      <table ref={tableRef} className={isLinking ? 'grid-is-linking' : ''}>
        <colgroup>
          <col style={{ width: '370px', minWidth: '200px', maxWidth: '450px' }} />
          <col style={{ width: '330px', minWidth: '180px', maxWidth: '420px' }} />
          {daysRange.map((_, index) => <col key={`col-day-${index}`} style={{ width: dayHeaderStyle.width }} />)}
        </colgroup>
        <thead ref={theadRef}>
          <tr>
            <th
              rowSpan="3"
              colSpan="2"
              style={{
                backgroundColor: '#e9ecef', // Cohérent avec les en-têtes de mois
                whiteSpace: 'nowrap',
                padding: '10px',
                fontSize: '1.1em', // Texte un peu plus gros
                fontWeight: 'bold',
                textAlign: 'center',
                verticalAlign: 'middle',
                borderLeft: '1px solid #999999', // Bordure standard des cellules d'en-tête
                borderTop: '1px solid #999999',   // Bordure standard des cellules d'en-tête de la première ligne
                borderRight: '2px solid #999999', // Bordure droite marquée, comme les noms de projet
                borderBottom: '2px solid #999999', // Aligné avec la bordure basse des en-têtes de jour
                // boxSizing, position:sticky, top, zIndex sont hérités du CSS pour `thead th`
              }}
            >
              Projets / Lots / Interventions
            </th>
            {months.map((m, i) => (
              <th 
                key={`month-${i}`} 
                colSpan={m.count} 
                style={monthHeaderStyle}
              >
                {m.label}
              </th>
            ))}
          </tr>
          <tr>
            {/* La première cellule est maintenant gérée par rowSpan depuis la ligne précédente */}
            {weeks.map((w, i) => (
              <th 
                key={`week-${i}`} 
                colSpan={w.count} 
                style={weekHeaderStyle}
              >
                S{w.week}
              </th>
            ))}
          </tr>
          <tr>
            {/* La première cellule est maintenant gérée par rowSpan depuis la première ligne */}
            {daysRange.map((d, i) => {
              const isSpecial = !isLoadingSpecialDays && (checkIsPublicHoliday(d) || checkIsSchoolVacationZoneB(d));
              const isLastDayOfWeekInHeader = (i === daysRange.length - 1) || (i < daysRange.length - 1 && d.isoWeek() !== daysRange[i + 1].isoWeek());
              let thClassName = '';
              if (isSpecial) thClassName += ' holiday-vacation';
              if (isLastDayOfWeekInHeader) thClassName += ' day-cell-week-end'; // Utiliser la même classe que pour le corps
              return (
                <th key={`day-${i}`} style={dayHeaderStyle} className={thClassName} data-date={d.format('YYYY-MM-DD')}>
                  <div 
                    style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                    onDragOver={handleDragOverCell} 
                    onDrop={(e) => handleDropCell(e, d.format('YYYY-MM-DD'))}
                  >
                    {d.format('DD')}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {projets.filter(projet => !!expandedProjetsState[projet.id]).map((projet) => {
            const areProjectLotsVisibleInGrid = !!projectLotsVisibilityState[projet.id];
            
            return (
              <React.Fragment key={`projet-fragment-${projet.id}`}>
                <tr key={`project-header-${projet.id}`} className="project-row project-header-row">
                  <td className="project-name-cell" colSpan={areProjectLotsVisibleInGrid ? 2 : 1}>
                    <span 
                      onClick={() => onToggleProjectLotsVisibility(projet.id)} 
                      style={{ cursor: 'pointer', marginRight: '5px', userSelect: 'none' }}
                    >
                      {areProjectLotsVisibleInGrid ? '▼' : '▶'}
                    </span>
                    <span 
                      onClick={() => onEditProjet && onEditProjet(projet)} 
                      style={{ cursor: 'pointer' }} 
                      title={`Modifier ${projet.nom}`}
                    >
                      {projet.nom}
                    </span>
                  </td>
                  {!areProjectLotsVisibleInGrid && (
                    <td className="intervention-name-cell project-name-cell-empty-filler"></td>
                  )}
                  {daysRange.map((day, dayIndex) => {
                    if (!areProjectLotsVisibleInGrid) return renderCompiledProjectDayCell(projet, day, dayIndex);
                    
                    const isLastDayOfWeekInLoop = (dayIndex === daysRange.length - 1) ||
                                              (dayIndex < daysRange.length - 1 && day.isoWeek() !== daysRange[dayIndex + 1].isoWeek());
                    const isSpecialDayInLoop = !isLoadingSpecialDays && (checkIsPublicHoliday(day) || checkIsSchoolVacationZoneB(day));
                    let cellClassName = `day-cell-base project-day-cell`;
                    if (isSpecialDayInLoop) cellClassName += ' holiday-vacation';
                    if (isLastDayOfWeekInLoop) cellClassName += ' day-cell-week-end';
                    
                    return (
                      <td 
                        key={`proj-day-${projet.id}-${dayIndex}`} 
                        className={cellClassName} 
                        data-date={day.format('YYYY-MM-DD')} 
                        onDragOver={handleDragOverCell} 
                        onDrop={(e) => handleDropCell(e, day.format('YYYY-MM-DD'))}
                      />
                    );
                  })}
                </tr>
                {areProjectLotsVisibleInGrid && (projet.lots || []).map(lot => {
                  const areLotInterventionsVisible = !!expandedLotInterventionsState[lot.id];
                  
                  const allInterventionsDataForThisLot = interventions
                    .filter(iv => iv.lot_id === lot.id)
                    .map(iv => ({ ...iv, id: iv.id, raw: iv, start: moment(iv.date), end: moment(iv.date_fin || iv.date) }))
                    .filter(ivData => ivData.start.isValid() && ivData.end.isValid())
                    .sort((a, b) => { 
                        if (a.start.isBefore(b.start)) return -1;
                        if (a.start.isAfter(b.start)) return 1;
                        if (a.id < b.id) return -1;
                        if (a.id > b.id) return 1;
                        return 0;
                    });

                  const lotNameCellRowSpan = (areLotInterventionsVisible && allInterventionsDataForThisLot.length > 0) ? allInterventionsDataForThisLot.length : 1;
                  const firstInterventionDataForDisplay = allInterventionsDataForThisLot[0];
                  
                  return (
                    <React.Fragment key={`lot-fragment-${lot.id}`}>
                      <tr key={`lot-header-${lot.id}`} className="lot-row lot-header-row">
                        <td className="lot-name-cell" rowSpan={lotNameCellRowSpan}>
                          <span 
                            onClick={() => onToggleLotInterventions(lot.id)} 
                            style={{ cursor: 'pointer', marginRight: '5px', userSelect: 'none' }}
                          >
                            {areLotInterventionsVisible ? '▼' : '▶'}
                          </span>
                          <span 
                            onClick={() => onEditLot && onEditLot(lot)} 
                            style={{ cursor: 'pointer' }} 
                            title={`Modifier ${lot.nom}`}
                          >
                            {lot.nom}
                          </span>
                        </td>
                        {!areLotInterventionsVisible ? (
                          <>
                            <td className="intervention-name-cell lot-name-cell-empty-filler"></td>
                            {daysRange.map((day, dayIndex) => renderCompiledLotDayCell(lot, day, dayIndex))}
                          </>
                        ) : firstInterventionDataForDisplay ? (
                          <>
                            {/* Modifié pour utiliser un div interne pour flexbox */}
                            <td className="intervention-name-cell-outer first-intervention-name-cell">
                              <div className="intervention-name-cell-inner">
                                <span 
                                  onClick={(e) => { e.stopPropagation(); handleToggleInterventionVisibility(firstInterventionDataForDisplay.raw);}} 
                                  style={{ cursor: 'pointer', marginRight: '8px', fontSize: '1.1em', lineHeight: '1' }}
                                  title={firstInterventionDataForDisplay.raw?.visible_sur_planning !== false ? "Cacher l'intervention" : "Afficher l'intervention"}
                                >
                                  {firstInterventionDataForDisplay.raw?.visible_sur_planning !== false ? '◉' : '○'}
                                </span>
                                <span 
                                  onClick={() => { if (onEditIntervention) onEditIntervention(firstInterventionDataForDisplay.raw); }}
                                  style={{ cursor: 'pointer', flexGrow: 1 }}
                                  title={`Modifier ${firstInterventionDataForDisplay.raw?.nom || 'Intervention'}`}
                                >
                                  {firstInterventionDataForDisplay.raw?.nom || 'Intervention'}
                                </span>
                              </div>
                            </td>
                            {daysRange.map((_, dayIdx) => renderInterventionCells(firstInterventionDataForDisplay, dayIdx, daysRange, true))}
                          </>
                        ) : (
                          <>
                            <td className="intervention-name-cell no-intervention-cell">(Aucune intervention)</td>
                            {daysRange.map((day, dayIndex) => {
                              const isSpecial = !isLoadingSpecialDays && (checkIsPublicHoliday(day) || checkIsSchoolVacationZoneB(day));
                              const isLastDayOfWeekInLoop = (dayIndex === daysRange.length - 1) ||
                                                        (dayIndex < daysRange.length - 1 && day.isoWeek() !== daysRange[dayIndex + 1].isoWeek());
                              let cellStyle = {};
                              let cellClassName = `day-cell-base lot-row-day-cell`;
                              if (isSpecial) cellClassName += ' holiday-vacation';
                              if (isLastDayOfWeekInLoop) cellClassName += ' day-cell-week-end';

                              if (isResizing && resizePreviewSpan && day.isBetween(resizePreviewSpan.start, resizePreviewSpan.end, 'day', '[]') && resizingInfo?.lotId === lot.id) {
                                  cellStyle.backgroundColor = 'rgba(0, 100, 255, 0.2)';
                                  cellStyle.outline = '1px dashed rgba(0, 100, 255, 0.5)';
                              }
                              
                              return (
                                <td 
                                  key={`lot-empty-int-day-${lot.id}-${dayIndex}`} 
                                  style={cellStyle} 
                                  className={cellClassName} 
                                  data-date={day.format('YYYY-MM-DD')} 
                                  onDragOver={handleDragOverCell} 
                                  onDrop={(e) => handleDropCell(e, day.format('YYYY-MM-DD'))}
                                />
                              );
                            })}
                          </>
                        )}
                      </tr>
                      {areLotInterventionsVisible && allInterventionsDataForThisLot.slice(1).map(interventionData => (
                        <tr key={`intervention-row-${interventionData.id}`} className="intervention-row">
                          {/* Modifié pour utiliser un div interne pour flexbox */}
                          <td className="intervention-name-cell-outer">
                            <div className="intervention-name-cell-inner">
                              <span 
                                onClick={(e) => { e.stopPropagation(); handleToggleInterventionVisibility(interventionData.raw);}} 
                                style={{ cursor: 'pointer', marginRight: '8px', fontSize: '1.1em', lineHeight: '1' }}
                                title={interventionData.raw?.visible_sur_planning !== false ? "Cacher l'intervention" : "Afficher l'intervention"}
                              >
                                {interventionData.raw?.visible_sur_planning !== false ? '◉' : '○'}
                              </span>
                              <span 
                                onClick={() => { if (onEditIntervention) onEditIntervention(interventionData.raw); }}
                                style={{ cursor: 'pointer', flexGrow: 1 }}
                                title={`Modifier ${interventionData.raw?.nom || 'Intervention'}`}
                              >
                                {interventionData.raw?.nom || 'Intervention'}
                              </span>
                            </div>
                          </td>
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
        <Modal isOpen={isDeleteLinkModalOpen} onClose={() => handleOpenDeleteLinkModal(null)}>
          <h3 style={{ marginTop: 0 }}>Supprimer la Liaison ?</h3>
          <p>
            Êtes-vous sûr de vouloir supprimer la liaison entre l'intervention
            "{interventions.find(i => i.id === linkToDelete.source_intervention_id)?.nom || 'Source inconnue'}"
            et "{interventions.find(i => i.id === linkToDelete.target_intervention_id)?.nom || 'Cible inconnue'}" ?
          </p>
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => handleOpenDeleteLinkModal(null)} style={{ marginRight: '10px' }}>Annuler</button>
            <button onClick={handleDeleteLink} style={{ backgroundColor: 'red', color: 'white' }}>Supprimer</button>
          </div>
        </Modal>
      )}
      {showLegend && (
        <div style={{ marginTop: '20px' }}>
          <Legend interventionEtats={interventionEtats} />
        </div>
      )}
    </div>
  );
}
