// c:\Users\Cynthia\planning-app\planning-app\src\hooks\useInterventionLinking.js
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export const useInterventionLinking = ({
  interventions,
  links,
  refetchLinks,
  svgDrawingLayerRef,
  tableRef,
  dayCellStyle, // Passé en prop pour minVerticalClearance
  isLoadingData,
}) => {
  const [isLinking, setIsLinking] = useState(false);
  const [linkDragInfo, setLinkDragInfo] = useState(null);
  const [isDeleteLinkModalOpen, setIsDeleteLinkModalOpen] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState(null);

  const findInterventionById = useCallback((id) => {
    return interventions.find(iv => iv.id === id);
  }, [interventions]);

  const determineLinkType = (sourceHandleType, targetHandleType) => {
    if (sourceHandleType === 'end' && targetHandleType === 'start') return 'finish-to-start';
    if (sourceHandleType === 'start' && targetHandleType === 'finish') return 'start-to-finish';
    if (sourceHandleType === 'end' && targetHandleType === 'end') return 'finish-to-finish';
    if (sourceHandleType === 'start' && targetHandleType === 'start') return 'start-to-start';
    console.warn(`[determineLinkType] Unexpected types: ${sourceHandleType}, ${targetHandleType}. Defaulting.`);
    return 'finish-to-start';
  };

  const createLinkInDb = async (sourceId, targetId, linkType) => {
    if (sourceId === targetId) {
      console.warn('[createLinkInDb] Cannot link to itself.');
      return;
    }
    const { data, error } = await supabase.from('links').insert([{ source_intervention_id: sourceId, target_intervention_id: targetId, link_type: linkType }]).select();
    if (error) {
      console.error('Erreur création lien:', error);
      if (error.code === '23505') {
        console.warn('Ce lien existe déjà (selon la BDD). Tentative de synchronisation...');
        const { data: existingLinkData, error: fetchError } = await supabase
          .from('links')
          .select('id')
          .eq('source_intervention_id', sourceId)
          .eq('target_intervention_id', targetId)
          .eq('link_type', linkType)
          .maybeSingle();

        if (fetchError) {
          console.error("Erreur lors de la recherche du lien existant après conflit:", fetchError);
          if (refetchLinks) refetchLinks();
        } else if (existingLinkData && refetchLinks) {
          console.log(`Conflit résolu: Le lien existant a l'ID ${existingLinkData.id}. Signalement à App.jsx.`);
          refetchLinks({ type: 'conflict_resolved', id: existingLinkData.id });
        } else if (refetchLinks) {
          if (refetchLinks) refetchLinks();
        }
      }
    } else {
      console.log('Lien créé:', data);
      if (refetchLinks && data && data.length > 0) {
        refetchLinks({ type: 'add', id: data[0].id, newLink: data[0] });
      } else if (refetchLinks) { refetchLinks(); }
    }
  };

  const handleLinkDragStart = (e, interventionData, handleType) => {
    e.stopPropagation();
    setIsLinking(true);
    const sourceHandleElement = e.target;
    const sourceRect = sourceHandleElement.getBoundingClientRect();
    const svgRect = svgDrawingLayerRef.current?.getBoundingClientRect();
    let sourceSvgX, sourceSvgY;
    if (svgRect) {
      sourceSvgX = sourceRect.left + sourceRect.width / 2 - svgRect.left;
      sourceSvgY = sourceRect.top + sourceRect.height / 2 - svgRect.top;
    }
    setLinkDragInfo({ sourceInterventionId: interventionData.id, sourceIntervention: interventionData.raw, sourceHandleType: handleType, sourceSvgX, sourceSvgY });

    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'intervention-link', sourceInterventionId: interventionData.id, sourceHandleType: handleType }));
    e.dataTransfer.effectAllowed = 'link';
  };

  const drawTemporaryLink = useCallback((x1, y1, x2, y2) => {
    const svg = svgDrawingLayerRef.current;
    if (!svg) return;
    let tempLine = svg.querySelector('#temp-link-line');
    if (!tempLine) {
      tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tempLine.setAttribute('id', 'temp-link-line');
      tempLine.setAttribute('stroke-width', '2');
      tempLine.setAttribute('pointer-events', 'none');
      tempLine.setAttribute('stroke', 'blue');
      // tempLine.setAttribute('marker-end', 'url(#arrowhead)'); // Arrowhead definition might be in ThreeMonthGrid or CSS
      svg.appendChild(tempLine);
    }
    tempLine.setAttribute('x1', x1);
    tempLine.setAttribute('y1', y1);
    tempLine.setAttribute('x2', x2);
    tempLine.setAttribute('y2', y2);
  }, [svgDrawingLayerRef]);

  const removeTemporaryLink = useCallback(() => {
    svgDrawingLayerRef.current?.querySelector('#temp-link-line')?.remove();
  }, [svgDrawingLayerRef]);

  const handleLinkDropOnHandle = (e, targetInterventionData, targetHandleType) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLinking && linkDragInfo) {
      const linkType = determineLinkType(linkDragInfo.sourceHandleType, targetHandleType);
      createLinkInDb(linkDragInfo.sourceInterventionId, targetInterventionData.id, linkType);
    }
    setIsLinking(false);
    setLinkDragInfo(null);
    removeTemporaryLink();
  };

  const handleOpenDeleteLinkModal = (link) => {
    setLinkToDelete(link);
    setIsDeleteLinkModalOpen(true);
  };

  const handleDeleteLink = async () => {
    if (!linkToDelete) return;
    const linkIdToDelete = linkToDelete.id;
    const { error } = await supabase.from('links').delete().eq('id', linkIdToDelete);

    if (error) {
      console.error(`Erreur suppression lien ID ${linkIdToDelete}:`, error);
    } else {
      if (refetchLinks) refetchLinks({ type: 'delete', id: linkIdToDelete });
    }
    setIsDeleteLinkModalOpen(false);
    setLinkToDelete(null);
  };

  const getHandleSvgPosition = useCallback((interventionId, handleType) => {
    const selector = `.link-handle-${handleType}[data-intervention-id="${interventionId}"]`;
    const handleElement = document.querySelector(selector);
    if (!handleElement) return null;

    const svgRect = svgDrawingLayerRef.current?.getBoundingClientRect();
    if (!svgRect) return null;

    const handleRect = handleElement.getBoundingClientRect();
    if (handleRect.width > 0 && handleRect.height > 0) {
      return {
        x: handleRect.left + handleRect.width / 2 - svgRect.left,
        y: handleRect.top + handleRect.height / 2 - svgRect.top,
      };
    }
    return null;
  }, [svgDrawingLayerRef]);

  const drawPermanentLinks = useCallback(() => {
    const svg = svgDrawingLayerRef.current;
    const table = tableRef.current;

    if (isLoadingData || !svg || !links || !interventions || !table) {
      svg?.querySelectorAll('.permanent-link-group').forEach(group => group.remove());
      return;
    }
    svg.style.width = `${table.scrollWidth}px`;
    svg.style.height = `${table.scrollHeight}px`;
    svg.querySelectorAll('.permanent-link-group').forEach(group => group.remove());

    if (links.length === 0) return;

    links.forEach(link => {
      let actualSourceHandleType, actualTargetHandleType;
      if (link.link_type === 'finish-to-start') { actualSourceHandleType = 'end'; actualTargetHandleType = 'start'; }
      else if (link.link_type === 'start-to-finish') { actualSourceHandleType = 'start'; actualTargetHandleType = 'end'; }
      else if (link.link_type === 'finish-to-finish') { actualSourceHandleType = 'end'; actualTargetHandleType = 'end'; }
      else if (link.link_type === 'start-to-start') { actualSourceHandleType = 'start'; actualTargetHandleType = 'start'; }
      else { console.warn(`Type de lien inconnu: ${link.link_type}`); return; }

      const sourcePos = getHandleSvgPosition(link.source_intervention_id, actualSourceHandleType);
      const targetPos = getHandleSvgPosition(link.target_intervention_id, actualTargetHandleType);

      if (sourcePos && targetPos) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'permanent-link-group');
        group.style.cursor = 'pointer';
        group.addEventListener('click', (e) => {
            e.stopPropagation();
            handleOpenDeleteLinkModal(link);
        });

        const stubLength = 15;
        const minVerticalClearance = (parseInt(dayCellStyle?.minHeight, 10) || 24) + 6;
        const sx = sourcePos.x; const sy = sourcePos.y;
        const tx = targetPos.x; const ty = targetPos.y;
        const p1 = { x: sx, y: sy };
        const p2x = (actualSourceHandleType === 'start' ? sx - stubLength : sx + stubLength);
        const p2 = { x: p2x, y: sy };
        const p6 = { x: tx, y: ty };
        const p5x = (actualTargetHandleType === 'start' ? tx - stubLength : tx + stubLength);
        const p5 = { x: p5x, y: ty };
        let pointsAttribute;

        if (Math.abs(sy - ty) < 1) {
            let middleY = (p2.x <= p5.x) ? sy - minVerticalClearance : sy + minVerticalClearance;
            pointsAttribute = `${p1.x},${p1.y} ${p2.x},${p2.y} ${p2.x},${middleY} ${p5.x},${middleY} ${p5.x},${p5.y} ${p6.x},${p6.y}`;
        } else if (Math.abs(sy - ty) < 2 * minVerticalClearance) {
            pointsAttribute = `${p1.x},${p1.y} ${p2.x},${p2.y} ${p2.x},${p6.y} ${p5.x},${p5.y} ${p6.x},${p6.y}`;
        } else {
            let middleY = (ty > sy) ? sy + minVerticalClearance : sy - minVerticalClearance;
            const p3 = { x: p2.x, y: middleY };
            const p4 = { x: p5.x, y: middleY };
            pointsAttribute = `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y} ${p5.x},${p5.y} ${p6.x},${p6.y}`;
        }

        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttribute('points', pointsAttribute);
        polyline.setAttribute('stroke', 'grey');
        polyline.setAttribute('stroke-width', '2');
        polyline.setAttribute('fill', 'none');
        polyline.setAttribute('pointer-events', 'stroke');
        group.appendChild(polyline);

        // Arrow drawing logic (simplified for brevity, can be enhanced)
        const numPointsArr = pointsAttribute.split(' ');
        if (numPointsArr.length >= 4) { // Ensure there's a segment to place an arrow
            const lastPointStr = numPointsArr[numPointsArr.length - 1].split(',');
            const secondLastPointStr = numPointsArr[numPointsArr.length - 2].split(',');
            const ax = parseFloat(lastPointStr[0]);
            const ay = parseFloat(lastPointStr[1]);
            const bx = parseFloat(secondLastPointStr[0]); // Point before the target handle
            const by = parseFloat(secondLastPointStr[1]);

            const angle = Math.atan2(ay - by, ax - bx);
            const arrowLength = 8;
            const arrowPoint1 = `${ax - arrowLength * Math.cos(angle - Math.PI / 6)},${ay - arrowLength * Math.sin(angle - Math.PI / 6)}`;
            const arrowPoint2 = `${ax - arrowLength * Math.cos(angle + Math.PI / 6)},${ay - arrowLength * Math.sin(angle + Math.PI / 6)}`;
            const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            arrow.setAttribute('points', `${ax},${ay} ${arrowPoint1} ${arrowPoint2}`);
            arrow.setAttribute('fill', 'grey');
            group.appendChild(arrow);
        }
        svg.appendChild(group);
      }
    });
  }, [links, interventions, getHandleSvgPosition, tableRef, dayCellStyle, isLoadingData, findInterventionById, handleOpenDeleteLinkModal]); // Added findInterventionById and handleOpenDeleteLinkModal

  useEffect(() => {
    const handleGlobalDragOver = (e) => {
      if (isLinking && linkDragInfo?.sourceSvgX !== undefined && linkDragInfo?.sourceSvgY !== undefined && svgDrawingLayerRef.current) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'link';
        const svgRect = svgDrawingLayerRef.current.getBoundingClientRect();
        const currentSvgX = e.clientX - svgRect.left;
        const currentSvgY = e.clientY - svgRect.top;
        drawTemporaryLink(linkDragInfo.sourceSvgX, linkDragInfo.sourceSvgY, currentSvgX, currentSvgY);
      }
    };
    const handleGlobalDragEnd = () => {
      if (isLinking) {
        removeTemporaryLink();
        // setIsLinking(false); // Moved to handleLinkDropOnHandle or if drop is outside
        // setLinkDragInfo(null);
      }
    };
    window.addEventListener('dragover', handleGlobalDragOver);
    window.addEventListener('dragend', handleGlobalDragEnd);
    return () => {
      window.removeEventListener('dragover', handleGlobalDragOver);
      window.removeEventListener('dragend', handleGlobalDragEnd);
    };
  }, [isLinking, linkDragInfo, drawTemporaryLink, removeTemporaryLink, svgDrawingLayerRef]);

  return {
    isLinking,
    setIsLinking, // Expose if needed for external reset on drag end outside drop target
    linkDragInfo,
    setLinkDragInfo, // Expose if needed for external reset
    isDeleteLinkModalOpen,
    linkToDelete,
    handleLinkDragStart,
    handleLinkDropOnHandle,
    drawPermanentLinks,
    handleOpenDeleteLinkModal,
    handleDeleteLink,
    removeTemporaryLink, // Expose for dragend if drop is not on a valid target
  };
};