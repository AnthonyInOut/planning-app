// api/send-synthesis.js (ou netlify/functions/send-synthesis.js)
const { createClient } = require('@supabase/supabase-js');
const moment = require('moment'); // Utiliser moment de npm
const nodemailer = require('nodemailer'); // Remplacer Resend par Nodemailer

// Initialiser les clients Supabase et Resend
// Les URL et clés seront lues depuis les variables d'environnement de votre plateforme serverless
const supabaseUrl = process.env.SUPABASE_URL; // Utiliser SUPABASE_URL côté serveur
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Clé de service pour les droits élevés
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configuration du transporteur Nodemailer pour Brevo (SMTP)
const transporter = nodemailer.createTransport({
  host: process.env.BREVO_SMTP_HOST,
  port: process.env.BREVO_SMTP_PORT || 587,
  secure: (process.env.BREVO_SMTP_PORT === '465'),
  auth: {
    user: process.env.BREVO_SMTP_LOGIN,
    pass: process.env.BREVO_SMTP_KEY,
  },
});

// États (assurez-vous qu'ils correspondent à ceux de votre frontend)
const ETAT_DEVIS_DEMANDE = "Demande de devis";
const ETAT_DEVIS_RECU_ATTENTE_VALIDATION = "Devis reçu - Attente validation";
const ETAT_A_NE_PAS_OUBLIER = "A ne pas oublier";
// ... autres états pertinents

// Fonction pour générer le contenu HTML de la synthèse pour un utilisateur
const generateSynthesisHtml = async (userId, configContenu) => {
    // Récupérer les projets assignés à l'utilisateur
    const { data: projetsData, error: projetsError } = await supabase
        .from('projets')
        .select('id, nom, lots (id, nom, interventions (*))') // Récupérer les interventions directement
        .eq('user_id', userId); // Filtrer par l'utilisateur

    if (projetsError) {
        console.error("Erreur récupération projets pour synthèse:", projetsError);
        throw new Error("Erreur lors de la récupération des données du planning.");
    }

    let syntheseHtml = '';
    const today = moment();

    // Aplatir les interventions pour un traitement plus facile
    const toutesInterventions = projetsData?.flatMap(p => p.lots?.flatMap(l =>
        (l.interventions || []).map(i => ({
            ...i,
            lot_nom: l.nom,
            projet_nom: p.nom
        }))
    ) || []);

    // --- Section: Interventions semaine prochaine ---
    if (configContenu.contenu_interventions_semaine_prochaine) {
      const debutSemaineProchaine = moment().add(1, 'week').startOf('isoWeek');
      const finSemaineProchaine = moment().add(1, 'week').endOf('isoWeek');
      const interventionsSemaineProchaine = toutesInterventions.filter(i => {
        const dateDebutIntervention = moment(i.date);
        return dateDebutIntervention.isBetween(debutSemaineProchaine, finSemaineProchaine, undefined, '[]');
      });

      if (interventionsSemaineProchaine.length > 0) {
        syntheseHtml += `<h2>Interventions prévues la semaine prochaine (${debutSemaineProchaine.format('DD/MM')} - ${finSemaineProchaine.format('DD/MM')})</h2><ul>`;
        interventionsSemaineProchaine.forEach(i => {
          syntheseHtml += `<li>Projet: ${i.projet_nom || 'N/A'} - Lot: ${i.lot_nom || 'N/A'} - <b>${i.nom || 'Intervention'}</b> (du ${moment(i.date).format('DD/MM')} au ${moment(i.date_fin || i.date).format('DD/MM')}) - État: ${i.etat}</li>`;
        });
        syntheseHtml += `</ul>`;
      }
    }

    // --- Section: Devis demandés à relancer ---
    // NOTE: Cette logique nécessite une colonne 'date_changement_etat' ou similaire dans votre table 'interventions'
    // pour savoir depuis quand l'intervention est dans cet état. L'exemple ci-dessous est conceptuel.
    const devisDemandesARelancer = toutesInterventions.filter(i =>
      i.etat === ETAT_DEVIS_DEMANDE
      // && moment(i.date_changement_etat_devis_demande).isBefore(today.clone().subtract(configContenu.contenu_delai_alerte_devis_demande_jours, 'days'))
    );
    if (devisDemandesARelancer.length > 0 && configContenu.contenu_delai_alerte_devis_demande_jours > 0) {
        syntheseHtml += `<h2>Devis demandés à relancer (depuis > ${configContenu.contenu_delai_alerte_devis_demande_jours} jours)</h2><ul>`;
        devisDemandesARelancer.forEach(i => {
            syntheseHtml += `<li>Projet: ${i.projet_nom || 'N/A'} - Lot: ${i.lot_nom || 'N/A'} - <b>${i.nom || 'Intervention'}</b> - État: ${i.etat}</li>`;
        });
        syntheseHtml += `</ul>`;
    }

    // --- Section: Devis en attente de validation à relancer ---
     // NOTE: Nécessite une colonne 'date_changement_etat' ou similaire
    const devisAttenteValidationARelancer = toutesInterventions.filter(i =>
      i.etat === ETAT_DEVIS_RECU_ATTENTE_VALIDATION
      // && moment(i.date_changement_etat_devis_attente).isBefore(today.clone().subtract(configContenu.contenu_delai_alerte_devis_attente_validation_jours, 'days'))
    );
    if (devisAttenteValidationARelancer.length > 0 && configContenu.contenu_delai_alerte_devis_attente_validation_jours > 0) {
        syntheseHtml += `<h2>Devis en attente de validation à relancer (depuis > ${configContenu.contenu_delai_alerte_devis_attente_validation_jours} jours)</h2><ul>`;
        devisAttenteValidationARelancer.forEach(i => {
            syntheseHtml += `<li>Projet: ${i.projet_nom || 'N/A'} - Lot: ${i.lot_nom || 'N/A'} - <b>${i.nom || 'Intervention'}</b> - État: ${i.etat}</li>`;
        });
        syntheseHtml += `</ul>`;
    }

    // --- Section: Interventions proches ---
    const interventionsProches = toutesInterventions.filter(i => {
        const dateDebutIntervention = moment(i.date);
        return dateDebutIntervention.isBetween(today, today.clone().add(configContenu.contenu_delai_alerte_intervention_proche_jours, 'days'), undefined, '[]');
    });
     if (interventionsProches.length > 0 && configContenu.contenu_delai_alerte_intervention_proche_jours > 0) {
        syntheseHtml += `<h2>Interventions prévues dans les ${configContenu.contenu_delai_alerte_intervention_proche_jours} prochains jours</h2><ul>`;
        interventionsProches.forEach(i => {
            syntheseHtml += `<li>Projet: ${i.projet_nom || 'N/A'} - Lot: ${i.lot_nom || 'N/A'} - <b>${i.nom || 'Intervention'}</b> (Prévue le ${moment(i.date).format('DD/MM/YYYY')}) - État: ${i.etat}</li>`;
        });
        syntheseHtml += `</ul>`;
    }

    // --- Section: Validation artisan attendue ---
    // Cette logique dépend de comment vous définissez "validation artisan attendue".
    // Exemple simplifié : interventions proches qui ne sont pas encore validées par l'artisan
    const validationArtisanAttendue = toutesInterventions.filter(i => {
        const dateDebutIntervention = moment(i.date);
        return dateDebutIntervention.isBetween(today, today.clone().add(configContenu.contenu_delai_alerte_validation_artisan_jours, 'days'), undefined, '[]')
               && i.etat !== "Intervention validée artisan" // Assurez-vous que le nom de l'état est correct
               && i.etat !== "Terminé"; // Et d'autres états qui ne nécessitent plus de validation
    });
    if (validationArtisanAttendue.length > 0 && configContenu.contenu_delai_alerte_validation_artisan_jours > 0) {
        syntheseHtml += `<h2>Validations artisan attendues dans les ${configContenu.contenu_delai_alerte_validation_artisan_jours} prochains jours</h2><ul>`;
        validationArtisanAttendue.forEach(i => {
            syntheseHtml += `<li>Projet: ${i.projet_nom || 'N/A'} - Lot: ${i.lot_nom || 'N/A'} - <b>${i.nom || 'Intervention'}</b> (Prévue le ${moment(i.date).format('DD/MM/YYYY')}) - État actuel: ${i.etat}</li>`;
        });
        syntheseHtml += `</ul>`;
    }


    // --- Section: Interventions "À ne pas oublier" ---
    if (configContenu.contenu_interventions_a_ne_pas_oublier) {
      const interventionsANePasOublier = toutesInterventions.filter(i => i.etat === ETAT_A_NE_PAS_OUBLIER);
      if (interventionsANePasOublier.length > 0) {
        syntheseHtml += `<h2>Interventions "À ne pas oublier"</h2><ul>`;
        interventionsANePasOublier.forEach(i => {
          syntheseHtml += `<li>Projet: ${i.projet_nom || 'N/A'} - Lot: ${i.lot_nom || 'N/A'} - <b>${i.nom || 'Intervention'}</b> (du ${moment(i.date).format('DD/MM')} au ${moment(i.date_fin || i.date).format('DD/MM')})</li>`;
        });
        syntheseHtml += `</ul>`;
      }
    }


    if (syntheseHtml === '') { // Si aucune section n'a ajouté de contenu
        syntheseHtml = "<p>Aucune information pertinente à signaler pour cette période selon les critères sélectionnés.</p>";
    }

    return syntheseHtml;
};


// Le gestionnaire principal de la fonction serverless
module.exports = async (req, res) => {
  if (req.method === 'POST') {
    try {
      // Le corps de la requête POST contiendra les informations nécessaires
      const { user_id, config_contenu } = req.body;

      if (!user_id || !config_contenu) {
        return res.status(400).json({ error: 'user_id et config_contenu sont requis dans le corps de la requête.' });
      }

      // 1. Récupérer les informations de l'utilisateur (pour son email)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('name, email')
        .eq('id', user_id)
        .single();

      if (userError || !userData || !userData.email) {
        console.error("Erreur récupération utilisateur ou email manquant:", userError);
        return res.status(404).json({ error: "Utilisateur non trouvé ou email manquant." });
      }

      // 2. Générer le contenu HTML de la synthèse
      const syntheseHtml = await generateSynthesisHtml(user_id, config_contenu);

      // 3. Envoyer l'email
      // Assurez-vous que votre service d'envoi d'email est configuré
      const emailSubject = `Votre synthèse de planning - ${moment().format('DD/MM/YYYY')}`;
      const emailBody = `
        <html>
        <body>
          <h1>Synthèse de Planning</h1>
          ${syntheseHtml}
          <p>Ceci est un email automatique. Veuillez ne pas y répondre.</p>
        </body>
        </html>
      `;

      // Envoi avec Nodemailer (Brevo)
      const emailInfo = await transporter.sendMail({
        from: '"Votre Planning App" <planning.inout@gmail.com>', // REMPLACEZ par VOTRE adresse unique vérifiée
        to: userData.email,
        replyTo: userData.email, // Optionnel: Permet à l'utilisateur de répondre à lui-même ou à l'email pertinent
        subject: emailSubject,
        html: `
          <html>
          <body>
            <p>Bonjour ${userData.name || 'Utilisateur'},</p>
            <h1>Synthèse de Planning</h1>
            ${syntheseHtml}
            <p>Cet email vous a été envoyé par Votre Planning App.</p>
            <p>Ceci est un email automatique.</p>
          </body>
          </html>
        `,
      });
      // Nodemailer ne retourne pas d'erreur ici si l'envoi est accepté par le serveur SMTP,
      // mais lève une exception en cas d'échec de connexion/authentification.
      // Les erreurs de délivrabilité sont gérées par Brevo (bounces, etc.).
      console.log(`Synthèse envoyée avec succès à ${userData.email}`, emailInfo.messageId);
      return res.status(200).json({ message: `Synthèse envoyée avec succès à ${userData.email}` });

    } catch (error) {
      console.error('Erreur inattendue dans la fonction serverless:', error);
      return res.status(500).json({ error: error.message || 'Erreur interne du serveur' });
    }
  } else {
    // Méthode non autorisée
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};
