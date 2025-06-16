export const INTERVENTION_ETATS = {
  DEMANDE_DEVIS: 'Demande du devis',
  ATTENTE_VALIDATION_DEVIS: 'Attente validation devis',
  DEVIS_VALIDE: 'Devis validé',
  PREVISION_INTERVENTION: 'Prévision d’intervention',
  INTERVENTION_VALIDEE_ARTISAN: 'Intervention validée artisan',
  OK_MATERIAUX: 'Ok matériaux',
  A_NE_PAS_OUBLIER: 'A ne pas oublier',
  TERMINE: 'Terminé',
};

export const ETAT_CATEGORIES = {
  PREPARATION: 'Phase préparation',
  PLANIFICATION: 'Planification',
  ANNEXE: 'Annexe',
};

export const ETATS_PAR_CATEGORIE = {
  [ETAT_CATEGORIES.PREPARATION]: [
    INTERVENTION_ETATS.DEMANDE_DEVIS,
    INTERVENTION_ETATS.ATTENTE_VALIDATION_DEVIS,
    INTERVENTION_ETATS.DEVIS_VALIDE,
  ],
  [ETAT_CATEGORIES.PLANIFICATION]: [
    INTERVENTION_ETATS.PREVISION_INTERVENTION,
    INTERVENTION_ETATS.INTERVENTION_VALIDEE_ARTISAN,
    INTERVENTION_ETATS.OK_MATERIAUX,
  ],
  [ETAT_CATEGORIES.ANNEXE]: [
    INTERVENTION_ETATS.A_NE_PAS_OUBLIER,
    INTERVENTION_ETATS.TERMINE,
  ],
};

export const ETAT_STYLES = {
  [INTERVENTION_ETATS.DEMANDE_DEVIS]: {
    label: INTERVENTION_ETATS.DEMANDE_DEVIS,
    category: ETAT_CATEGORIES.PREPARATION,
    hachures: true,
    backgroundOpacity: 0.4,
    borderColor: 'purple',
    borderStyle: 'dashed',
    textColor: '#000000',
  },
  [INTERVENTION_ETATS.ATTENTE_VALIDATION_DEVIS]: {
    label: INTERVENTION_ETATS.ATTENTE_VALIDATION_DEVIS,
    category: ETAT_CATEGORIES.PREPARATION,
    hachures: true,
    backgroundOpacity: 0.4,
    borderColor: 'orange',
    borderStyle: 'dashed',
    textColor: '#000000',
  },
  [INTERVENTION_ETATS.DEVIS_VALIDE]: {
    label: INTERVENTION_ETATS.DEVIS_VALIDE,
    category: ETAT_CATEGORIES.PREPARATION,
    hachures: true,
    backgroundOpacity: 0.4,
    borderColor: 'darkgreen',
    borderStyle: 'solid', // Contour plein
    textColor: '#000000',
  },
  [INTERVENTION_ETATS.PREVISION_INTERVENTION]: {
    label: INTERVENTION_ETATS.PREVISION_INTERVENTION,
    category: ETAT_CATEGORIES.PLANIFICATION,
    hachures: false,
    backgroundOpacity: 1,
    borderColor: 'orange',
    borderStyle: 'dashed',
    textColor: (bgColor) => контрастностьЦвета(bgColor) > 128 ? '#000000' : '#FFFFFF', // Texte noir ou blanc selon contraste
  },
  [INTERVENTION_ETATS.INTERVENTION_VALIDEE_ARTISAN]: {
    label: INTERVENTION_ETATS.INTERVENTION_VALIDEE_ARTISAN,
    category: ETAT_CATEGORIES.PLANIFICATION,
    hachures: false,
    backgroundOpacity: 1,
    borderColor: 'darkgreen', // Vert foncé
    borderStyle: 'dashed',
    textColor: (bgColor) => контрастностьЦвета(bgColor) > 128 ? '#000000' : '#FFFFFF',
  },
  [INTERVENTION_ETATS.OK_MATERIAUX]: {
    label: INTERVENTION_ETATS.OK_MATERIAUX,
    category: ETAT_CATEGORIES.PLANIFICATION,
    hachures: false,
    backgroundOpacity: 1,
    borderColor: 'darkgreen', // Vert foncé
    borderStyle: 'solid', // Contour plein
    textColor: (bgColor) => контрастностьЦвета(bgColor) > 128 ? '#000000' : '#FFFFFF',
  },
  [INTERVENTION_ETATS.A_NE_PAS_OUBLIER]: {
    label: INTERVENTION_ETATS.A_NE_PAS_OUBLIER,
    category: ETAT_CATEGORIES.ANNEXE,
    hachures: false,
    backgroundOpacity: 1,
    borderColor: 'purple',
    borderStyle: 'solid', // Contour plein
    textColor: (bgColor) => контрастностьЦвета(bgColor) > 128 ? '#000000' : '#FFFFFF',
    needsDateUpdate: true,
  },
  [INTERVENTION_ETATS.TERMINE]: {
    label: INTERVENTION_ETATS.TERMINE,
    category: ETAT_CATEGORIES.ANNEXE,
    hachures: false,
    backgroundOpacity: 0.3, // Transparence
    borderColor: 'black',
    borderStyle: 'solid', // Contour plein
    textColor: '#000000',
  },
};

// Fonction simple pour déterminer la couleur du texte (noir ou blanc) basée sur la luminosité du fond.
// Vous pouvez l'affiner ou utiliser une bibliothèque si nécessaire.
function контрастностьЦвета(hexColor) {
  if (!hexColor || hexColor.length < 7) return 0; // Couleur invalide ou pas assez d'infos
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

// Fonction pour générer le style CSS des hachures
export const getHachuresStyle = (baseColor, opacity = 0.5) => {
  if (!baseColor || baseColor.length < 7) baseColor = '#CCCCCC'; // Couleur par défaut si invalide

  const hexToRgb = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  };

  const { r, g, b } = hexToRgb(baseColor);
  const rgbaColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
  const transparentColor = `rgba(${r}, ${g}, ${b}, 0)`; // Pour un effet de hachure plus subtil

  return {
    // Hachures avec la couleur de base et une version transparente de cette couleur
    backgroundImage: `repeating-linear-gradient(45deg, ${rgbaColor}, ${rgbaColor} 5px, ${transparentColor} 5px, ${transparentColor} 10px)`,
    // Si vous voulez des hachures sur un fond déjà coloré (par l'opacité de la barre),
    // vous pouvez utiliser une couleur de hachure fixe, par exemple :
    // backgroundImage: `repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) 5px, transparent 5px, transparent 10px)`,
  };
};