// c:\Users\Cynthia\planning-app\planning-app\src\GestionEntreprisesModal.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';

const GestionEntreprisesModal = ({ isOpen, onClose, onEntrepriseAddedOrUpdated }) => {
  const [entreprises, setEntreprises] = useState([]);
  const [nomEntreprise, setNomEntreprise] = useState('');
  const [contactNom, setContactNom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [adresse, setAdresse] = useState('');
  const [entrepriseEnEdition, setEntrepriseEnEdition] = useState(null); // Pour l'édition
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchEntreprises = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('entreprises').select('*').order('nom', { ascending: true });
    if (error) {
      console.error("Erreur lors de la récupération des entreprises:", error);
      setMessage(`Erreur: ${error.message}`);
    } else {
      setEntreprises(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchEntreprises();
      setMessage('');
      setNomEntreprise('');
      setContactNom('');
      setEmail('');
      setTelephone('');
      setAdresse('');
      setEntrepriseEnEdition(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nomEntreprise.trim()) {
      setMessage("Le nom de l'entreprise ne peut pas être vide.");
      return;
    }
    setIsLoading(true);
    setMessage('');

    const payload = {
      nom: nomEntreprise.trim(),
      contact_nom: contactNom.trim() || null,
      email: email.trim() || null,
      telephone: telephone.trim() || null,
      adresse: adresse.trim() || null,
    };

    let error;
    if (entrepriseEnEdition) {
      // Mode édition
      const { error: updateError } = await supabase
        .from('entreprises')
        .update(payload)
        .eq('id', entrepriseEnEdition.id);
      error = updateError;
    } else {
      // Mode création
      const { error: insertError } = await supabase
        .from('entreprises')
        .insert([payload]);
      error = insertError;
    }

    if (error) {
      console.error("Erreur lors de la sauvegarde de l'entreprise:", error);
      setMessage(`Erreur: ${error.message}`);
    } else {
      setMessage(entrepriseEnEdition ? 'Entreprise mise à jour !' : 'Entreprise ajoutée !');
      setNomEntreprise('');
      setContactNom('');
      setEmail('');
      setTelephone('');
      setAdresse('');
      setEntrepriseEnEdition(null);
      fetchEntreprises(); // Rafraîchir la liste
      onEntrepriseAddedOrUpdated?.(); // Informer le parent si nécessaire
    }
    setIsLoading(false);
  };

  const handleEdit = (entreprise) => {
    setEntrepriseEnEdition(entreprise);
    setNomEntreprise(entreprise.nom);
    setContactNom(entreprise.contact_nom || '');
    setEmail(entreprise.email || '');
    setTelephone(entreprise.telephone || '');
    setAdresse(entreprise.adresse || '');
    setMessage('');
  };

  const handleDelete = async (entrepriseId) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette entreprise ? Cela pourrait affecter les lots associés.")) {
      setIsLoading(true);
      const { error } = await supabase.from('entreprises').delete().eq('id', entrepriseId);
      if (error) {
        console.error("Erreur lors de la suppression de l'entreprise:", error);
        setMessage(`Erreur: ${error.message}`);
      } else {
        setMessage('Entreprise supprimée !');
        fetchEntreprises(); // Rafraîchir la liste
        onEntrepriseAddedOrUpdated?.();
      }
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ padding: '20px', maxHeight: '80vh', overflowY: 'auto' }}>
      <h3 style={{ marginTop: 0 }}>Gestion des Entreprises</h3>
      <form onSubmit={handleSubmit} style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <label htmlFor="nomEntreprise" style={{display: 'block', marginBottom: '2px'}}>Nom de l'entreprise *</label>
          <input
            id="nomEntreprise"
            type="text"
            placeholder="Nom de l'entreprise"
            value={nomEntreprise}
            onChange={(e) => setNomEntreprise(e.target.value)}
            required
            style={{ padding: '8px', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label htmlFor="contactNom" style={{display: 'block', marginBottom: '2px'}}>Nom du contact</label>
          <input
            id="contactNom"
            type="text"
            placeholder="Nom du contact"
            value={contactNom}
            onChange={(e) => setContactNom(e.target.value)}
            style={{ padding: '8px', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label htmlFor="email" style={{display: 'block', marginBottom: '2px'}}>Email</label>
          <input
            id="email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: '8px', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label htmlFor="telephone" style={{display: 'block', marginBottom: '2px'}}>Téléphone</label>
          <input
            id="telephone"
            type="tel"
            placeholder="Téléphone"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            style={{ padding: '8px', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label htmlFor="adresse" style={{display: 'block', marginBottom: '2px'}}>Adresse</label>
          <textarea
            id="adresse"
            placeholder="Adresse"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            style={{ padding: '8px', width: '100%', boxSizing: 'border-box', minHeight: '60px' }}
          />
        </div>
        <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
          <button type="submit" disabled={isLoading} style={{ padding: '8px 15px' }}>
            {isLoading ? 'Chargement...' : (entrepriseEnEdition ? 'Mettre à jour' : 'Ajouter')}
          </button>
          {entrepriseEnEdition && (
            <button type="button" onClick={() => { setEntrepriseEnEdition(null); setNomEntreprise(''); setContactNom(''); setEmail(''); setTelephone(''); setAdresse(''); setMessage(''); }} style={{ padding: '8px 15px' }}>
              Annuler l'édition
            </button>
          )}
        </div>
      </form>
      {message && <p>{message}</p>}
      {isLoading && entreprises.length === 0 && <p>Chargement des entreprises...</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {entreprises.map(entreprise => (
          <li key={entreprise.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee' }}>
            <div style={{flexGrow: 1}}>
              <strong>{entreprise.nom}</strong>
              {entreprise.contact_nom && <div style={{fontSize: '0.9em', color: '#555'}}>Contact: {entreprise.contact_nom}</div>}
              {entreprise.email && <div style={{fontSize: '0.9em', color: '#555'}}>Email: {entreprise.email}</div>}
              {entreprise.telephone && <div style={{fontSize: '0.9em', color: '#555'}}>Tél: {entreprise.telephone}</div>}
              {entreprise.adresse && <div style={{fontSize: '0.9em', color: '#555'}}>Adresse: {entreprise.adresse}</div>}
            </div>
            <div>
              <button onClick={() => handleEdit(entreprise)} style={{ marginRight: '10px', padding: '5px 10px' }} disabled={isLoading}>Modifier</button>
              <button onClick={() => handleDelete(entreprise.id)} style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white' }} disabled={isLoading}>Supprimer</button>
            </div>
          </li>
        ))}
      </ul>
      <button onClick={onClose} style={{ marginTop: '20px', padding: '10px 20px' }}>Fermer</button>
    </div>
  );
};

export default GestionEntreprisesModal;
