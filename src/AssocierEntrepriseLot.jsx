import { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';

const AssocierEntrepriseLot = () => {
  const [entreprises, setEntreprises] = useState([]);
  const [lots, setLots] = useState([]);
  const [associations, setAssociations] = useState([]);
  const [entrepriseId, setEntrepriseId] = useState('');
  const [lotId, setLotId] = useState('');
  const [message, setMessage] = useState('');

  // Charger entreprises, lots, et associations existantes
  useEffect(() => {
    const fetchData = async () => {
      const { data: entreprisesData } = await supabase.from('entreprises').select('id, nom');
      const { data: lotsData } = await supabase.from('lots').select('id, nom');
      const { data: associationsData } = await supabase
        .from('entreprise_lot')
        .select('id, entreprise_id, lot_id, entreprises (nom), lots (nom)');

      setEntreprises(entreprisesData || []);
      setLots(lotsData || []);
      setAssociations(associationsData || []);
    };
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { error } = await supabase.from('entreprise_lot').insert([{ entreprise_id: entrepriseId, lot_id: lotId }]);
    if (error) {
      setMessage("Erreur : " + error.message);
    } else {
      setMessage("Association réussie !");
      setEntrepriseId('');
      setLotId('');
      // Recharger les associations
      const { data: updatedAssociations } = await supabase
        .from('entreprise_lot')
        .select('id, entreprise_id, lot_id, entreprises (nom), lots (nom)');
      setAssociations(updatedAssociations || []);
    }
  };

  return (
    <div>
      <h2>Associer une entreprise à un lot</h2>
      <form onSubmit={handleSubmit}>
        <select value={entrepriseId} onChange={(e) => setEntrepriseId(e.target.value)} required>
          <option value="">-- Choisir une entreprise --</option>
          {entreprises.map(e => (
            <option key={e.id} value={e.id}>{e.nom}</option>
          ))}
        </select>
        <select value={lotId} onChange={(e) => setLotId(e.target.value)} required>
          <option value="">-- Choisir un lot --</option>
          {lots.map(l => (
            <option key={l.id} value={l.id}>{l.nom}</option>
          ))}
        </select>
        <button type="submit">Associer</button>
      </form>
      {message && <p>{message}</p>}

      <h3>Associations existantes</h3>
      <ul>
        {associations.map((a) => (
          <li key={a.id}>
            {a.entreprises?.nom} ↔ {a.lots?.nom}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AssocierEntrepriseLot;
