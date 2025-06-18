const// api/schedule-synthesis-handler.js (ou netlify/functions/schedule-synthesis-handler.js)
const { createClient } = require('@supabase/supabase-js');
const moment = require('moment');
const nodemailer = require('nodemailer');

// Initialisation des clients (variables d'environnement)
const supabaseUrl = process.env.SUPABASE_URL; // Doit être SUPABASE_URL et non VITE_SUPABASE_URL côté serveur
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Utiliser la clé de service pour les opérations backend
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configuration du transporteur Nodemailer pour Brevo (SMTP)
const transporter = nodemailer.createTransport({
  host: process.env.BREVO_SMTP_HOST, // ex: 'smtp-relay.brevo.com'
  port: process.env.BREVO_SMTP_PORT || 587, // Port SMTP, 587 est courant pour TLS
  secure: (process.env.BREVO_SMTP_PORT === '465'), // true pour le port 465 (SSL), false pour les autres (TLS)
  auth: {
    user: process.env.BREVO_SMTP_LOGIN, // Votre login SMTP Brevo (souvent votre email d'inscription)
    pass: process.env.BREVO_SMTP_KEY, // Votre clé SMTP Brevo
  },
});

// États (doivent correspondre à ceux de votre frontend/DB)
const ETAT_DEVIS_DEMANDE = "Demande de devis";
const ETAT_DEVIS_RECU_ATTENTE_VALIDATION = "Devis reçu - Attente validation";
const ETAT_A_NE_PAS_OUBLIER = "A ne pas oublier";
// ... autres états pertinents

// Fonction pour générer le contenu HTML de la synthèse (adaptée de send-synthesis.js)
// Vous pourriez envisager de l'extraire dans un module partagé si vous voulez éviter la duplication
async function generateSynthesisHtmlForUser(userId, configContenu) {
    const { data: projetsData, error: projetsError } = await supabase
        .from('projets')
        .select('id, nom, lots (id, nom, interventions (*))')
        .eq('user_id', userId);

    if (projetsError) {
        console.error(`Erreur récupération projets pour user ${userId}:`, projetsError);
        // Retourner une chaîne vide ou un message d'erreur simple pour ne pas bloquer les autres
        return "<p>Erreur lors de la récupération des données du planning pour cet utilisateur.</p>";
    }

    let syntheseHtml = '';
    const today = moment();
    const toutesInterventions = projetsData?.flatMap(p => p.lots?.flatMap(l =>
        (l.interventions || []).map(i => ({ ...i, lot_nom: l.nom, projet_nom: p.nom }))
    ) || []);

    // --- Section: Interventions semaine prochaine ---
    if (configContenu.contenu_interventions_semaine_prochaine) {
        const debutSemaineProchaine = moment().add(1, 'week').startOf('isoWeek');
        const finSemaineProchaine = moment().add(1, 'week').endOf('isoWeek');
        const interventionsSemaineProchaine = toutesInterventions.filter(i =>
            moment(i.date).isBetween(debutSemaineProchaine, finSemaineProchaine, undefined, '[]')
        );
        if (interventionsSemaineProchaine.length > 0) {
            syntheseHtml += `<h2>Interventions prévues la semaine prochaine (${debutSemaineProchaine.format('DD/MM')} - ${finSemaineProchaine.format('DD/MM')})</h2><ul>`;
            interventionsSemaineProchaine.forEach(i => {
                syntheseHtml += `<li>Projet: ${i.projet_nom || 'N/A'} - Lot: ${i.lot_nom || 'N/A'} - <b>${i.nom || 'Intervention'}</b> (du ${moment(i.date).format('DD/MM')} au ${moment(i.date_fin || i.date).format('DD/MM')}) - État: ${i.etat}</li>`;
            });
            syntheseHtml += `</ul>`;
        }
    }

    // --- Section: Devis demandés à relancer ---
    if (configContenu.contenu_delai_alerte_devis_demande_jours > 0) {
        const devisDemandesARelancer = toutesInterventions.filter(i =>
            i.etat === ETAT_DEVIS_DEMANDE
            // && moment(i.date_changement_etat_devis_demande).isBefore(today.clone().subtract(configContenu.contenu_delai_alerte_devis_demande_jours, 'days'))
        );
        if (devisDemandesARelancer.length > 0) {
            syntheseHtml += `<h2>Devis demandés à relancer (depuis > ${configContenu.contenu_delai_alerte_devis_demande_jours} jours)</h2><ul>`;
            devisDemandesARelancer.forEach(i => {
                syntheseHtml += `<li>Projet: ${i.projet_nom || 'N/A'} - Lot: ${i.lot_nom || 'N/A'} - <b>${i.nom || 'Intervention'}</b> - État: ${i.etat}</li>`;
            });
            syntheseHtml += `</ul>`;
        }
    }

    // --- Section: Devis en attente de validation à relancer ---
    if (configContenu.contenu_delai_alerte_devis_attente_validation_jours > 0) {
        const devisAttenteValidationARelancer = toutesInterventions.filter(i =>
            i.etat === ETAT_DEVIS_RECU_ATTENTE_VALIDATION
            // && moment(i.date_changement_etat_devis_attente).isBefore(today.clone().subtract(configContenu.contenu_delai_alerte_devis_attente_validation_jours, 'days'))
        );
        if (devisAttenteValidationARelancer.length > 0) {
            syntheseHtml += `<h2>Devis en attente de validation à relancer (depuis > ${configContenu.contenu_delai_alerte_devis_attente_validation_jours} jours)</h2><ul>`;
            devisAttenteValidationARelancer.forEach(i => {
                syntheseHtml += `<li>Projet: ${i.projet_nom || 'N/A'} - Lot: ${i.lot_nom || 'N/A'} - <b>${i.nom || 'Intervention'}</b> - État: ${i.etat}</li>`;
            });
            syntheseHtml += `</ul>`;
        }
    }

    // --- Section: Interventions proches ---
    if (configContenu.contenu_delai_alerte_intervention_proche_jours > 0) {
        const interventionsProches = toutesInterventions.filter(i =>
            moment(i.date).isBetween(today, today.clone().add(configContenu.contenu_delai_alerte_intervention_proche_jours, 'days'), undefined, '[]')
        );
        if (interventionsProches.length > 0) {
            syntheseHtml += `<h2>Interventions prévues dans les ${configContenu.contenu_delai_alerte_intervention_proche_jours} prochains jours</h2><ul>`;
            interventionsProches.forEach(i => {
                syntheseHtml += `<li>Projet: ${i.projet_nom || 'N/A'} - Lot: ${i.lot_nom || 'N/A'} - <b>${i.nom || 'Intervention'}</b> (Prévue le ${moment(i.date).format('DD/MM/YYYY')}) - État: ${i.etat}</li>`;
            });
            syntheseHtml += `</ul>`;
        }
    }

    // --- Section: Validation artisan attendue ---
    if (configContenu.contenu_delai_alerte_validation_artisan_jours > 0) {
        const validationArtisanAttendue = toutesInterventions.filter(i => {
            const dateDebutIntervention = moment(i.date);
            return dateDebutIntervention.isBetween(today, today.clone().add(configContenu.contenu_delai_alerte_validation_artisan_jours, 'days'), undefined, '[]')
                   && i.etat !== "Intervention validée artisan"
                   && i.etat !== "Terminé";
        });
        if (validationArtisanAttendue.length > 0) {
            syntheseHtml += `<h2>Validations artisan attendues dans les ${configContenu.contenu_delai_alerte_validation_artisan_jours} prochains jours</h2><ul>`;
            validationArtisanAttendue.forEach(i => {
                syntheseHtml += `<li>Projet: ${i.projet_nom || 'N/A'} - Lot: ${i.lot_nom || 'N/A'} - <b>${i.nom || 'Intervention'}</b> (Prévue le ${moment(i.date).format('DD/MM/YYYY')}) - État actuel: ${i.etat}</li>`;
            });
            syntheseHtml += `</ul>`;
        }
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

    if (syntheseHtml === '') {
        syntheseHtml = "<p>Aucune information pertinente à signaler pour cette période selon les critères sélectionnés.</p>";
    }
    return syntheseHtml;
}

// Le gestionnaire principal pour la tâche planifiée
module.exports = async (req, res) => {
    console.log('Exécution de la tâche planifiée de synthèse email...');
    const now = moment();
    const currentDayOfWeek = now.day(); // Dimanche = 0, Lundi = 1, ..., Samedi = 6
    const currentTime = now.format('HH:mm'); // Comparer seulement HH:mm

    try {
        // 1. Récupérer toutes les configurations actives
        const { data: configurations, error: configError } = await supabase
            .from('configurations_synthese')
            .select('*')
            .eq('active', true);

        if (configError) {
            console.error("Erreur récupération des configurations de synthèse:", configError);
            return res.status(500).json({ error: "Erreur DB lors de la récupération des configurations." });
        }

        if (!configurations || configurations.length === 0) {
            console.log("Aucune configuration de synthèse active trouvée.");
            return res.status(200).json({ message: "Aucune configuration active." });
        }

        let emailsSentCount = 0;

        for (const config of configurations) {
            const configHeureEnvoi = config.heure_envoi ? moment(config.heure_envoi, 'HH:mm:ss').format('HH:mm') : null;

            // Vérifier si c'est le bon jour et la bonne heure
            // config.jours_envoi est un tableau d'entiers (0-6)
            if (config.jours_envoi && config.jours_envoi.includes(currentDayOfWeek) && configHeureEnvoi === currentTime) {
                console.log(`Configuration correspondante trouvée: ${config.nom_configuration}`);

                let recipientUserIds = [];
                if (config.destinataires_type === 'tous') {
                    const { data: allUsers, error: usersError } = await supabase.from('users').select('id');
                    if (usersError) {
                        console.error("Erreur récupération de tous les utilisateurs:", usersError);
                        continue; // Passer à la config suivante
                    }
                    recipientUserIds = allUsers.map(u => u.id);
                } else if (config.destinataires_type === 'selection' && config.destinataires_ids) {
                    recipientUserIds = config.destinataires_ids;
                }
                // 'currentUser' n'est pas pertinent pour une tâche cron, sauf si vous voulez l'envoyer au créateur de la config
                // else if (config.destinataires_type === 'currentUser' && config.user_id_creation) {
                //    recipientUserIds = [config.user_id_creation];
                // }


                if (recipientUserIds.length === 0) {
                    console.log(`Aucun destinataire pour la configuration ${config.nom_configuration}`);
                    continue;
                }

                // Extraire les paramètres de contenu de la configuration
                const configContenu = {
                    contenu_interventions_semaine_prochaine: config.contenu_interventions_semaine_prochaine,
                    contenu_delai_alerte_devis_demande_jours: config.contenu_delai_alerte_devis_demande_jours,
                    contenu_delai_alerte_devis_attente_validation_jours: config.contenu_delai_alerte_devis_attente_validation_jours,
                    contenu_delai_alerte_intervention_proche_jours: config.contenu_delai_alerte_intervention_proche_jours,
                    contenu_delai_alerte_validation_artisan_jours: config.contenu_delai_alerte_validation_artisan_jours,
                    contenu_interventions_a_ne_pas_oublier: config.contenu_interventions_a_ne_pas_oublier,
                };

                for (const userId of recipientUserIds) {
                    const { data: userData, error: userError } = await supabase
                        .from('users')
                        .select('name, email')
                        .eq('id', userId)
                        .single();

                    if (userError || !userData || !userData.email) {
                        console.warn(`Utilisateur ${userId} non trouvé ou email manquant. Skip.`);
                        continue;
                    }

                    const syntheseHtml = await generateSynthesisHtmlForUser(userId, configContenu);
                    const emailSubject = `Votre synthèse de planning (${config.nom_configuration}) - ${now.format('DD/MM/YYYY')}`;
                        const emailBody = `
                          <html>
                          <body>
                            <p>Bonjour ${userData.name || 'Utilisateur'},</p>
                            <h1>Synthèse de Planning</h1>
                            ${syntheseHtml}
                            <p>Cet email vous a été envoyé par Votre Planning App.</p>
                            <p>Ceci est un email automatique.</p>
                          </body>
                          </html>`;

                    try {
                        await transporter.sendMail({
                                from: '"Votre Planning App" <planning.inout@gmail.com>', // REMPLACEZ par VOTRE adresse unique vérifiée
                            to: userData.email, // Nodemailer prend une chaîne ou un tableau pour 'to'
                            subject: emailSubject,
                            html: emailBody,
                        });
                        console.log(`Synthèse envoyée à ${userData.email} pour config ${config.nom_configuration}`);
                        emailsSentCount++;
                    } catch (sendError) {
                        console.error(`Erreur envoi email à ${userData.email} pour config ${config.nom_configuration}:`, sendError);
                    }
                }
            }
        }

        return res.status(200).json({ message: `Tâche planifiée terminée. ${emailsSentCount} emails envoyés.` });

    } catch (error) {
        console.error('Erreur inattendue dans la tâche planifiée de synthèse:', error);
        return res.status(500).json({ error: error.message || 'Erreur interne du serveur lors de la tâche planifiée.' });
    }
};
