// c:\Users\Cynthia\planning-app\planning-app\src\GestionUtilisateursModal.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';

const GestionUtilisateursModal = ({ isOpen, onClose, onUserAddedOrUpdated }) => {
  const [users, setUsers] = useState([]);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userTelephone, setUserTelephone] = useState('');
  const [userEnEdition, setUserEnEdition] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchUsers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('users').select('*').order('name', { ascending: true });
    if (error) {
      console.error("Erreur lors de la récupération des utilisateurs:", error);
      setMessage(`Erreur: ${error.message}`);
    } else {
      setUsers(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      setMessage('');
      setUserName('');
      setUserEmail('');
      setUserTelephone('');
      setUserEnEdition(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userName.trim()) {
      setMessage("Le nom de l'utilisateur ne peut pas être vide.");
      return;
    }
    setIsLoading(true);
    setMessage('');

    const payload = {
      name: userName.trim(),
      email: userEmail.trim() || null,
      telephone: userTelephone.trim() || null,
    };

    let error;
    if (userEnEdition) {
      const { error: updateError } = await supabase
        .from('users')
        .update(payload)
        .eq('id', userEnEdition.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('users')
        .insert([payload]);
      error = insertError;
    }

    if (error) {
      console.error("Erreur lors de la sauvegarde de l'utilisateur:", error);
      setMessage(`Erreur: ${error.message}`);
    } else {
      setMessage(userEnEdition ? 'Utilisateur mis à jour !' : 'Utilisateur ajouté !');
      setUserName('');
      setUserEmail('');
      setUserTelephone('');
      setUserEnEdition(null);
      fetchUsers();
      onUserAddedOrUpdated?.();
    }
    setIsLoading(false);
  };

  const handleEdit = (user) => {
    setUserEnEdition(user);
    setUserName(user.name);
    setUserEmail(user.email || '');
    setUserTelephone(user.telephone || '');
    setMessage('');
  };

  const handleDelete = async (userId) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cela pourrait affecter les projets associés.")) {
      setIsLoading(true);
      // D'abord, mettre à jour les projets pour retirer l'assignation à cet utilisateur
      const { error: updateProjetsError } = await supabase
        .from('projets')
        .update({ user_id: null })
        .eq('user_id', userId);

      if (updateProjetsError) {
        console.error("Erreur lors de la désassignation des projets:", updateProjetsError);
        setMessage(`Erreur lors de la désassignation des projets: ${updateProjetsError.message}`);
        setIsLoading(false);
        return;
      }
      
      // Ensuite, supprimer l'utilisateur
      const { error: deleteUserError } = await supabase.from('users').delete().eq('id', userId);
      if (deleteUserError) {
        console.error("Erreur lors de la suppression de l'utilisateur:", deleteUserError);
        setMessage(`Erreur: ${deleteUserError.message}`);
      } else {
        setMessage('Utilisateur supprimé !');
        fetchUsers();
        onUserAddedOrUpdated?.();
      }
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ padding: '20px', maxHeight: '80vh', overflowY: 'auto' }}>
      <h3 style={{ marginTop: 0 }}>Gestion des Utilisateurs</h3>
      <form onSubmit={handleSubmit} style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <label htmlFor="userName" style={{display: 'block', marginBottom: '2px'}}>Nom de l'utilisateur *</label>
          <input
            id="userName"
            type="text"
            placeholder="Nom"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            required
            style={{ padding: '8px', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label htmlFor="userEmail" style={{display: 'block', marginBottom: '2px'}}>Email</label>
          <input
            id="userEmail"
            type="email"
            placeholder="Email"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            style={{ padding: '8px', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label htmlFor="userTelephone" style={{display: 'block', marginBottom: '2px'}}>Téléphone</label>
          <input
            id="userTelephone"
            type="tel"
            placeholder="Téléphone"
            value={userTelephone}
            onChange={(e) => setUserTelephone(e.target.value)}
            style={{ padding: '8px', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
          <button type="submit" disabled={isLoading} style={{ padding: '8px 15px' }}>
            {isLoading ? 'Chargement...' : (userEnEdition ? 'Mettre à jour' : 'Ajouter')}
          </button>
          {userEnEdition && (
            <button type="button" onClick={() => { setUserEnEdition(null); setUserName(''); setUserEmail(''); setUserTelephone(''); setMessage(''); }} style={{ padding: '8px 15px' }}>
              Annuler l'édition
            </button>
          )}
        </div>
      </form>
      {message && <p>{message}</p>}
      {isLoading && users.length === 0 && <p>Chargement des utilisateurs...</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {users.map(user => (
          <li key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee' }}>
            <div style={{flexGrow: 1}}>
              <strong>{user.name}</strong>
              {user.email && <div style={{fontSize: '0.9em', color: '#555'}}>Email: {user.email}</div>}
              {user.telephone && <div style={{fontSize: '0.9em', color: '#555'}}>Tél: {user.telephone}</div>}
            </div>
            <div>
              <button onClick={() => handleEdit(user)} style={{ marginRight: '10px', padding: '5px 10px' }} disabled={isLoading}>Modifier</button>
              <button onClick={() => handleDelete(user.id)} style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white' }} disabled={isLoading}>Supprimer</button>
            </div>
          </li>
        ))}
      </ul>
      <button onClick={onClose} style={{ marginTop: '20px', padding: '10px 20px' }}>Fermer</button>
    </div>
  );
};

export default GestionUtilisateursModal;
