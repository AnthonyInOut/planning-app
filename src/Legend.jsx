// src/Legend.jsx
import React from 'react';

// Helper function to convert hex to RGB (peut être mutualisée si utilisée ailleurs)
const hexToRgb = (hex) => {
  if (!hex) return { r: 128, g: 128, b: 128 }; // Gris par défaut
  let c;
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    c = hex.substring(1).split('');
    if (c.length === 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c = '0x' + c.join('');
    return { r: (c >> 16) & 255, g: (c >> 8) & 255, b: c & 255 };
  }
  return { r: 128, g: 128, b: 128 };
};

const Legend = ({ interventionEtats }) => {
  if (!interventionEtats) return null;

  const { ETAT_STYLES, ETAT_CATEGORIES, ETATS_PAR_CATEGORIE, getHachuresStyle } = interventionEtats;

  // Couleur de base pour les échantillons dans la légende.
  // Cela permet de montrer l'effet de l'opacité et des hachures de manière cohérente.
  const sampleBaseColor = '#D3D3D3'; // Gris clair

  return (
    <div style={{
      backgroundColor: '#f9f9f9',
      padding: '15px',
      marginTop: '20px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      fontFamily: 'Arial, sans-serif',
      fontSize: '0.9em'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '15px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>Légende des États d'Intervention</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}> {/* Conteneur Flex pour les catégories */}
        {Object.keys(ETAT_CATEGORIES).map(categoryKey => {
          const categoryName = ETAT_CATEGORIES[categoryKey];
          const etatsInCategory = ETATS_PAR_CATEGORIE[categoryName];

          return (
            // Chaque catégorie peut avoir une largeur définie ou flex-basis pour contrôler la disposition
            <div key={categoryName} style={{ marginBottom: '15px', marginRight: '20px', minWidth: '200px' }}> 
              <h4 style={{ marginTop: 0, marginBottom: '10px', color: '#333' }}>{categoryName}</h4>
              {etatsInCategory.map(etatValue => {
                const styleInfo = ETAT_STYLES[etatValue];
                if (!styleInfo) return null;

                let sampleStyle = {
                  width: '24px',
                  height: '24px',
                  marginRight: '10px',
                  display: 'inline-block',
                  border: `${styleInfo.borderWidth || '2px'} ${styleInfo.borderStyle || 'solid'} ${styleInfo.borderColor || sampleBaseColor}`,
                  verticalAlign: 'middle',
                };

                const { r, g, b } = hexToRgb(sampleBaseColor);
                sampleStyle.backgroundColor = `rgba(${r}, ${g}, ${b}, ${styleInfo.backgroundOpacity})`;

                if (styleInfo.hachures) {
                  const hachuresCss = getHachuresStyle(sampleBaseColor, 0.4); // Opacité des lignes de hachure
                  sampleStyle.backgroundImage = hachuresCss.backgroundImage;
                }

                return (
                  <div key={etatValue} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', paddingLeft: '10px' }}>
                    <span style={sampleStyle}></span>
                    <span>{styleInfo.label}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Legend;