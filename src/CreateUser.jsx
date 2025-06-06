import React, { useState } from 'react';
import { supabase } from './lib/supabaseClient';

const CreateUser = ({ onUserAdded, onCancel }) => {
  const [userName, setUserName] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userName.trim()) {
      setMessage("Le nom de l'utilisateur ne peut pas être vide.");
      return;
    }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('users')
      .insert([{ name: userName.trim() }])
      .select(); // Important to select to get the new user data if needed

    if (error) {
      setMessage("Erreur : " + error.message);
    } else {
      setMessage("Utilisateur créé avec succès !");
      setUserName('');
      if (onUserAdded) {
        onUserAdded(data ? data[0] : null); // Pass the new user data back
      }
    }
    setIsLoading(false);
  };

  return (
    <div style={{ padding: '1rem' }}>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="userName-create" style={{ display: 'block', marginBottom: '5px' }}>Nom de l'utilisateur :</label>
          <input type="text" id="userName-create" placeholder="Nom" value={userName} onChange={(e) => setUserName(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
          <button type="submit" disabled={isLoading} style={{ padding: '10px 15px' }}>{isLoading ? 'Création...' : 'Créer utilisateur'}</button>
          {onCancel && <button type="button" onClick={onCancel} style={{ padding: '10px 15px', backgroundColor: '#6c757d', color: 'white' }}>Annuler</button>}
        </div>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default CreateUser;