import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

const ListeProjets = () => {
  const [projets, setProjets] = useState([]);

  useEffect(() => {
    const fetchProjets = async () => {
      const { data, error } = await supabase.from("projets").select("*");
      if (error) {
        console.error("Erreur lors du chargement des projets :", error.message);
      } else {
        setProjets(data);
      }
    };

    fetchProjets();
  }, []);

  return (
    <div>
      <h2>Liste des projets</h2>
      {projets.length === 0 ? (
        <p>Aucun projet trouvé.</p>
      ) : (
        <ul>
          {projets.map((projet) => (
            <li key={projet.id}>
              <strong>{projet.nom}</strong> – {projet.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ListeProjets;
