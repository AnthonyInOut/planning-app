// utils/colorUtils.js

// 1. Couleur de base par projet
export const generateProjectColors = (projets = []) => { // Added default for projets
  const basePalette = ['#1abc9c','#3498db','#9b59b6','#e67e22','#e74c3c'];
  return projets.reduce((acc, p, idx) => {
    // Use the project's defined color if it exists, otherwise assign from palette
    acc[p.id] = p.color || basePalette[idx % basePalette.length]; // Use p.color to match DB column
    return acc;
  }, {});
};

// 2. Nuance selon l’indice d’intervention au sein du projet
export const generateInterventionColors = (interventions, projectColors) => {
  // Regroupe les interventions par projet (si projet_id existe)
  const colors = {};
  (interventions || []).forEach(intervention => {
    // Use the color of the lot the intervention belongs to
    const lotColor = intervention?.lots?.color;
    if (lotColor && lotColor.startsWith('#') && lotColor.length === 7) {
       colors[intervention.id] = lotColor;
    } else if (intervention?.lots?.projet_id && projectColors[intervention.lots.projet_id]) {
       // Fallback: use project color if lot color is missing but project color exists
       colors[intervention.id] = projectColors[intervention.lots.projet_id];
    } else {
      colors[intervention.id] = '#A0A0A0'; // Default grey if no color info is available
    }
  }); // This correctly closes the forEach

  return colors;
};
// Nouvelle fonction pour trouver une nuance disponible
export const findAvailableShade = (baseColor, usedColors, defaultColor = '#cccccc') => {
  console.log('[findAvailableShade] Appel avec baseColor:', baseColor, 'usedColors:', JSON.stringify(usedColors));
  if (!baseColor || !baseColor.startsWith('#')) {
    console.log('[findAvailableShade] baseColor invalide, retourne defaultColor:', defaultColor);
    return defaultColor; // Retourne une couleur par défaut si la couleur de base est invalide
  }

  const shadeSteps = [0, -15, 15, -25, 25, -10, 10, -5, 5, -30, 30]; // Ordre de préférence des nuances
  const lowerUsedColors = usedColors.map(c => c.toLowerCase());
  console.log('[findAvailableShade] lowerUsedColors:', JSON.stringify(lowerUsedColors));

  for (const step of shadeSteps) {
    const potentialShade = shadeColor(baseColor, step).toLowerCase();
    console.log(`[findAvailableShade] Essai avec step ${step}: potentialShade = ${potentialShade}`);
    if (!lowerUsedColors.includes(potentialShade)) {
      console.log('[findAvailableShade] Nuance trouvée et disponible:', potentialShade);
      return potentialShade; // Retourne la première nuance non utilisée
    }
  }
  console.log('[findAvailableShade] Aucune nuance disponible dans les steps prédéfinis, génération d\'une nuance aléatoire.');
  return shadeColor(baseColor, (Math.random() - 0.5) * 40); // En dernier recours, une nuance un peu aléatoire
};
// Utilitaire pour nuancer une couleur hex
export const shadeColor = (col, percent) => {
    // Add a check for invalid color input
  if (!col || typeof col !== 'string' || col.charAt(0) !== '#' || col.length !== 7) {
    // console.warn(`Invalid color passed to shadeColor: ${col}. Using default #cccccc.`);
    return '#cccccc'; // Return a default color
  }
  const num = parseInt(col.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return "#" + (
    0x1000000 +
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  ).toString(16).slice(1);
};
