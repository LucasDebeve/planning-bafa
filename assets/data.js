/* Données de référence : types de formation, catégories, séquences types et modèles. */
'use strict';

const FORMATIONS = {
  bafa1: {
    short: 'BAFA 1',
    label: 'BAFA 1 — Formation générale',
    days: 8,
  },
  bafa3: {
    short: 'BAFA 3',
    label: 'BAFA 3 — Session d\'approfondissement',
    days: 6,
  },
};

const CATEGORIES = [
  { id: 'vie', name: 'Vie collective', color: '#0284c7' },
  { id: 'theorie', name: 'Apports & réflexion', color: '#7c3aed' },
  { id: 'pratique', name: 'Activités & techniques', color: '#16a34a' },
  { id: 'regle', name: 'Réglementation & sécurité', color: '#dc2626' },
  { id: 'projet', name: 'Projets & préparation', color: '#d97706' },
  { id: 'bilan', name: 'Bilans & évaluation', color: '#db2777' },
  { id: 'veillee', name: 'Veillée', color: '#4f46e5' },
  { id: 'informel', name: 'Temps informel', color: '#64748b' },
];

const DEFAULT_SLOTS = [
  { id: 'matin', label: 'Matin', start: '09:00', end: '12:30' },
  { id: 'aprem', label: 'Après-midi', start: '14:00', end: '18:30' },
  { id: 'soir', label: 'Soirée', start: '20:30', end: '22:00' },
];

const DEFAULT_LIBRARY = [
  // Vie collective
  { title: 'Accueil des stagiaires', cat: 'vie' },
  { title: 'Présentation de la session et du cadre', cat: 'vie' },
  { title: 'Jeux de connaissance', cat: 'vie' },
  { title: 'Élaboration des règles de vie', cat: 'vie' },
  { title: 'Réunion de groupe / conseil', cat: 'vie' },
  { title: 'Vie quotidienne : lever, repas, coucher', cat: 'vie' },
  // Apports
  { title: 'Le BAFA : cursus et rôle de l\'animateur', cat: 'theorie' },
  { title: 'Développement et besoins de l\'enfant', cat: 'theorie' },
  { title: 'Rythmes de l\'enfant', cat: 'theorie' },
  { title: 'L\'adolescence', cat: 'theorie' },
  { title: 'Projet éducatif et projet pédagogique', cat: 'theorie' },
  { title: 'Relation aux familles et communication', cat: 'theorie' },
  { title: 'Laïcité, valeurs de la République', cat: 'theorie' },
  { title: 'Gestion des conflits', cat: 'theorie' },
  { title: 'Inclusion et accueil du handicap', cat: 'theorie' },
  // Pratique
  { title: 'Jeux d\'intérieur', cat: 'pratique' },
  { title: 'Jeux d\'extérieur', cat: 'pratique' },
  { title: 'Activités manuelles', cat: 'pratique' },
  { title: 'Chants et danses', cat: 'pratique' },
  { title: 'Contes et expression', cat: 'pratique' },
  { title: 'Grand jeu', cat: 'pratique' },
  { title: 'Activités d\'expression corporelle', cat: 'pratique' },
  { title: 'Sortie / balade nature', cat: 'pratique' },
  // Réglementation
  { title: 'Réglementation des ACM', cat: 'regle' },
  { title: 'Sécurité physique et affective', cat: 'regle' },
  { title: 'Hygiène, santé et assistant sanitaire', cat: 'regle' },
  { title: 'Responsabilité de l\'animateur', cat: 'regle' },
  { title: 'Prévention des maltraitances', cat: 'regle' },
  // Projets
  { title: 'Préparation de veillée (stagiaires)', cat: 'projet' },
  { title: 'Préparation du grand jeu (stagiaires)', cat: 'projet' },
  { title: 'Construction d\'un projet d\'activité', cat: 'projet' },
  { title: 'Mise en situation / animation par les stagiaires', cat: 'projet' },
  // Bilans
  { title: 'Bilan de journée', cat: 'bilan' },
  { title: 'Bilan intermédiaire', cat: 'bilan' },
  { title: 'Entretiens individuels', cat: 'bilan' },
  { title: 'Bilan final et évaluation', cat: 'bilan' },
  { title: 'Retour sur le stage pratique', cat: 'bilan' },
  // Veillées
  { title: 'Veillée de présentation', cat: 'veillee' },
  { title: 'Veillée contes', cat: 'veillee' },
  { title: 'Veillée jeux', cat: 'veillee' },
  { title: 'Veillée préparée par les stagiaires', cat: 'veillee' },
  { title: 'Veillée de clôture', cat: 'veillee' },
  // Informel
  { title: 'Temps libre', cat: 'informel' },
  { title: 'Rangement et départs', cat: 'informel' },
];

/* Modèles : [jour (0..n-1), créneau, intitulé, catégorie] */
const TEMPLATES = {
  bafa1: [
    [0, 'matin', 'Accueil des stagiaires', 'vie'],
    [0, 'matin', 'Présentation de la session et du cadre', 'vie'],
    [0, 'aprem', 'Jeux de connaissance', 'vie'],
    [0, 'aprem', 'Le BAFA : cursus et rôle de l\'animateur', 'theorie'],
    [0, 'soir', 'Veillée de présentation', 'veillee'],

    [1, 'matin', 'Élaboration des règles de vie', 'vie'],
    [1, 'matin', 'Développement et besoins de l\'enfant', 'theorie'],
    [1, 'aprem', 'Jeux d\'extérieur', 'pratique'],
    [1, 'aprem', 'Bilan de journée', 'bilan'],
    [1, 'soir', 'Veillée chants', 'veillee'],

    [2, 'matin', 'Réglementation des ACM', 'regle'],
    [2, 'aprem', 'Activités manuelles', 'pratique'],
    [2, 'aprem', 'Rythmes de l\'enfant', 'theorie'],
    [2, 'soir', 'Veillée contes', 'veillee'],

    [3, 'matin', 'Sécurité physique et affective', 'regle'],
    [3, 'matin', 'Hygiène, santé et assistant sanitaire', 'regle'],
    [3, 'aprem', 'Grand jeu', 'pratique'],
    [3, 'soir', 'Préparation de veillée (stagiaires)', 'projet'],

    [4, 'matin', 'Projet éducatif et projet pédagogique', 'theorie'],
    [4, 'aprem', 'Bilan intermédiaire', 'bilan'],
    [4, 'aprem', 'Chants et danses', 'pratique'],
    [4, 'soir', 'Veillée préparée par les stagiaires', 'veillee'],

    [5, 'matin', 'Vie quotidienne : lever, repas, coucher', 'vie'],
    [5, 'matin', 'Relation aux familles et communication', 'theorie'],
    [5, 'aprem', 'Préparation du grand jeu (stagiaires)', 'projet'],
    [5, 'soir', 'Veillée préparée par les stagiaires', 'veillee'],

    [6, 'matin', 'Grand jeu', 'projet'],
    [6, 'aprem', 'Responsabilité de l\'animateur', 'regle'],
    [6, 'aprem', 'Laïcité, valeurs de la République', 'theorie'],
    [6, 'soir', 'Veillée de clôture', 'veillee'],

    [7, 'matin', 'Entretiens individuels', 'bilan'],
    [7, 'aprem', 'Bilan final et évaluation', 'bilan'],
    [7, 'aprem', 'Rangement et départs', 'informel'],
  ],
  bafa3: [
    [0, 'matin', 'Accueil des stagiaires', 'vie'],
    [0, 'matin', 'Présentation de la session et du thème', 'vie'],
    [0, 'aprem', 'Retour sur le stage pratique', 'bilan'],
    [0, 'aprem', 'Jeux de connaissance', 'vie'],
    [0, 'soir', 'Veillée de présentation', 'veillee'],

    [1, 'matin', 'Apports sur le thème d\'approfondissement', 'theorie'],
    [1, 'aprem', 'Atelier technique autour du thème', 'pratique'],
    [1, 'soir', 'Veillée jeux', 'veillee'],

    [2, 'matin', 'Réglementation spécifique au thème', 'regle'],
    [2, 'aprem', 'Construction d\'un projet d\'activité', 'projet'],
    [2, 'soir', 'Préparation de veillée (stagiaires)', 'projet'],

    [3, 'matin', 'Bilan intermédiaire', 'bilan'],
    [3, 'matin', 'Mise en situation / animation par les stagiaires', 'projet'],
    [3, 'aprem', 'Atelier technique autour du thème', 'pratique'],
    [3, 'soir', 'Veillée préparée par les stagiaires', 'veillee'],

    [4, 'matin', 'Mise en situation / animation par les stagiaires', 'projet'],
    [4, 'aprem', 'Analyse des pratiques', 'theorie'],
    [4, 'soir', 'Veillée de clôture', 'veillee'],

    [5, 'matin', 'Entretiens individuels', 'bilan'],
    [5, 'aprem', 'Bilan final et évaluation', 'bilan'],
    [5, 'aprem', 'Rangement et départs', 'informel'],
  ],
};
