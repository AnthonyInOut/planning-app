// src/utils/holidays.js
import moment from 'moment';

// Cache simple pour éviter les appels API répétitifs pour les mêmes données
const apiCache = {
  publicHolidays: {},
  schoolVacations: {},
};

/**
 * Récupère les jours fériés pour une année donnée depuis l'API du gouvernement français.
 * @param {number} year - L'année pour laquelle récupérer les jours fériés.
 * @returns {Promise<string[]>} Une promesse qui résout en un tableau de dates (YYYY-MM-DD) des jours fériés.
 */
async function fetchPublicHolidaysFromAPI(year) {
  if (apiCache.publicHolidays[year]) {
    return apiCache.publicHolidays[year];
  }
  try {
    const response = await fetch(`https://calendrier.api.gouv.fr/jours-feries/metropole/${year}.json`);
    if (!response.ok) {
      console.error(`Erreur API jours fériés pour ${year}: ${response.status} ${response.statusText}`);
      apiCache.publicHolidays[year] = []; // Stocker un tableau vide en cas d'erreur pour éviter de réessayer immédiatement
      return [];
    }
    const data = await response.json(); // Format: {"YYYY-MM-DD": "Nom du jour férié", ...}
    const holidays = Object.keys(data);
    apiCache.publicHolidays[year] = holidays;
    return holidays;
  } catch (error) {
    console.error(`Erreur lors de la récupération des jours fériés pour ${year}:`, error);
    apiCache.publicHolidays[year] = [];
    return [];
  }
}

/**
 * Détermine l'année scolaire (ex: "2023-2024") pour une date donnée.
 * @param {moment.Moment} mDate - La date moment.
 * @returns {string} L'année scolaire.
 */
function getAcademicYearString(mDate) {
  const year = mDate.year();
  const month = mDate.month(); // 0 (Jan) à 11 (Dec)
  // L'année scolaire commence généralement en septembre (mois 8)
  if (month >= 8) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

/**
 * Récupère les vacances scolaires de la Zone B pour une année scolaire donnée.
 * @param {string} academicYear - L'année scolaire (ex: "2023-2024").
 * @returns {Promise<Array<{name: string, start: string, end: string}>>} Une promesse qui résout en un tableau d'objets de vacances.
 */
async function fetchSchoolVacationsZoneBFromAPI(academicYear) {
  if (apiCache.schoolVacations[academicYear]) {
    return apiCache.schoolVacations[academicYear];
  }
  try {
    // L'API utilise des 'refine' pour filtrer. annee_scolaire doit être exact.
    const apiUrl = `https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records?limit=20&refine=zones%3A%22Zone%20B%22&refine=annee_scolaire%3A%22${academicYear}%22`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      console.error(`Erreur API vacances scolaires pour ${academicYear} (Zone B): ${response.status} ${response.statusText}`);
      apiCache.schoolVacations[academicYear] = [];
      return [];
    }
    const data = await response.json();
    const vacations = data.results.map(record => ({
      name: record.description,
      start: moment(record.start_date).format('YYYY-MM-DD'), // Assurer le format
      end: moment(record.end_date).format('YYYY-MM-DD'),     // Assurer le format
    }));
    apiCache.schoolVacations[academicYear] = vacations;
    return vacations;
  } catch (error) {
    console.error(`Erreur lors de la récupération des vacances scolaires pour ${academicYear} (Zone B):`, error);
    apiCache.schoolVacations[academicYear] = [];
    return [];
  }
}

/**
 * Prépare les données des jours spéciaux (fériés et vacances) pour une plage de dates donnée.
 * @param {moment.Moment} viewStartDate - Date de début de la vue.
 * @param {moment.Moment} viewEndDate - Date de fin de la vue.
 * @returns {Promise<{publicHolidays: string[], schoolVacations: Array<{name: string, start: string, end: string}>}>}
 */
export async function getSpecialDaysDataForRange(viewStartDate, viewEndDate) {
  const yearsToFetchHolidays = new Set();
  const academicYearsToFetchVacations = new Set();

  let currentDate = viewStartDate.clone();
  while (currentDate.isSameOrBefore(viewEndDate, 'day')) {
    yearsToFetchHolidays.add(currentDate.year());
    academicYearsToFetchVacations.add(getAcademicYearString(currentDate));
    currentDate.add(1, 'day');
  }

  const publicHolidaysPromises = Array.from(yearsToFetchHolidays).map(fetchPublicHolidaysFromAPI);
  const schoolVacationsPromises = Array.from(academicYearsToFetchVacations).map(fetchSchoolVacationsZoneBFromAPI);

  try {
    const publicHolidaysResults = await Promise.all(publicHolidaysPromises);
    const schoolVacationsResults = await Promise.all(schoolVacationsPromises);

    return {
      publicHolidays: publicHolidaysResults.flat(), // Tableau de dates YYYY-MM-DD
      schoolVacations: schoolVacationsResults.flat(), // Tableau d'objets {name, start, end}
    };
  } catch (error) {
    console.error("Erreur lors de la combinaison des données des jours spéciaux:", error);
    return { publicHolidays: [], schoolVacations: [] };
  }
}


// Fonctions de vérification qui utiliseront les données pré-chargées
export function isPublicHoliday(date, holidaysDataArray) {
  if (!holidaysDataArray || holidaysDataArray.length === 0) return false;
  const dateString = moment(date).format('YYYY-MM-DD');
  return holidaysDataArray.includes(dateString);
}

export function isSchoolVacationZoneB(date, vacationsDataArray) {
  if (!vacationsDataArray || vacationsDataArray.length === 0) return false;
  const mDate = moment(date);
  return vacationsDataArray.some(vacation =>
    mDate.isBetween(moment(vacation.start), moment(vacation.end), 'day', '[]')
  );
}
