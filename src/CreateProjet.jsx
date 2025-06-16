import React, { useState } from 'react';
import { supabase } from './lib/supabaseClient';

const CreateProjet = ({ onAjout, onCancel, usersList, currentUser }) => {
  const [nomProjet, setNomProjet] = useState(''); // Renamed for clarity to match previous diffs
  const [message, setMessage] = useState('');
  const [couleurProjet, setCouleurProjet] = useState('#4a90e2'); // Default color
  const [isLoading, setIsLoading] = useState(false); // Added isLoading state
  const [selectedUserId, setSelectedUserId] = useState(currentUser?.id || ''); // State for selected user, default to currentUser
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const { data, error } = await supabase
      .from('projets')
      .insert([{ 
        nom: nomProjet.trim(), 
        color: couleurProjet,
        user_id: selectedUserId || null // Use the selected user ID, ensure null if empty
      }]);
    if (error) {
      setMessage("Erreur : " + error.message);
    } else {
      setMessage("Projet créé avec succès !");
      setNomProjet(''); // Reset the project name input
      // setDescription(''); // This state does not exist, remove or ensure it's intended
      setCouleurProjet('#4a90e2'); // Optionally reset color to default
      if (onAjout) {
        onAjout();
      }
    }
    setIsLoading(false);
  };

  return (
    <div style={{ padding: '1rem' }}> {/* Added some padding for modal use */}
      {/* Title is now handled by App.jsx when rendering the modal */}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="nomProjet-create" style={{ display: 'block', marginBottom: '5px' }}>Nom du projet :</label>
          <input
            type="text"
            id="nomProjet-create"
            placeholder="Nom du projet"
            value={nomProjet}
            onChange={(e) => setNomProjet(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="couleurProjet-create" style={{ display: 'block', marginBottom: '5px' }}>Couleur du projet :</label>
          <input type="color" id="couleurProjet-create" value={couleurProjet} onChange={(e) => setCouleurProjet(e.target.value)} style={{ width: '100%', padding: '3px', boxSizing: 'border-box', height: '40px' }} />
        </div>
        {usersList && usersList.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="userProjet-create" style={{ display: 'block', marginBottom: '5px' }}>Assigner à :</label>
            <select id="userProjet-create" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}>
              <option value="">Non assigné</option>
              {usersList.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>)}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
          <button type="submit" disabled={isLoading} style={{ padding: '10px 15px' }}>
            {isLoading ? 'Création...' : 'Créer le projet'}
          </button>
          {onCancel && <button type="button" onClick={onCancel} style={{ padding: '10px 15px', backgroundColor: '#6c757d', color: 'white' }}>Annuler</button>}
        </div>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};
export default CreateProjet;
