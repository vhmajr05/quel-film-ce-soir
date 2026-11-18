// ============================================================
// 1. CONFIGURATION
// ============================================================

// Ta clé TMDB (themoviedb.org > Paramètres > API). À remplir toi-même.
const API_KEY = "TA_CLE";

// Humeur (value du menu) -> identifiant de genre TMDB
const GENRES = {
  peur: 27,
  rire: 35,
  amour: 10749,
  action: 28,
  reflexion: 18,
};

// On récupère les éléments HTML une seule fois (via leur id)
const selectHumeur = document.getElementById("humeur");
const selectDuree = document.getElementById("duree");
const boutonTrouver = document.getElementById("btn-trouver");
const resultat = document.getElementById("resultat");

// ============================================================
// 2. RECHERCHE D'UN FILM AU HASARD (selon les menus)
// ============================================================
async function chercherFilm() {
  // Lit les valeurs ACTUELLES des menus (donc "Un autre film" garde les mêmes filtres)
  const genre = GENRES[selectHumeur.value];
  const dureeMax = selectDuree.value; // "90", "120", "150" ou "" (peu importe)

  resultat.innerHTML = '<p class="text-center text-zinc-400">Recherche en cours… 🍿</p>';

  try {
    const params = new URLSearchParams({
      api_key: API_KEY,
      with_genres: genre,
      sort_by: "popularity.desc",
      language: "fr-FR",
    });
    if (dureeMax !== "") {
      params.set("with_runtime.lte", dureeMax);
    }

    const reponse = await fetch("https://api.themoviedb.org/3/discover/movie?" + params);
    if (!reponse.ok) {
      throw new Error("Erreur TMDB : " + reponse.status);
    }

    const data = await reponse.json();
    const films = data.results;

    if (!films || films.length === 0) {
      resultat.innerHTML =
        '<p class="text-center text-zinc-400">Aucun film trouvé 😕 Essaie une autre durée ou humeur.</p>';
      return;
    }

    // Film au hasard parmi les résultats
    const film = films[Math.floor(Math.random() * films.length)];

    // true = on met l'URL à jour (?film=ID), car c'est une NOUVELLE découverte
    afficherFilm(film, true);
  } catch (erreur) {
    console.error(erreur);
    resultat.innerHTML =
      '<p class="text-center text-red-400">Oups, impossible de charger un film. Vérifie ta clé API et ta connexion.</p>';
  }
}

// ============================================================
// 3. CHARGER UN FILM PRÉCIS DEPUIS L'URL (?film=550)
// ============================================================
async function chargerFilmDepuisUrl() {
  // URLSearchParams lit les paramètres après le "?" de l'URL courante
  const idBrut = new URLSearchParams(window.location.search).get("film");

  // Pas de paramètre ?film= -> page normale avec les menus, on ne fait rien
  if (idBrut === null) {
    resultat.innerHTML = "";
    return;
  }

  // Validation : un ID TMDB est un entier positif (ex: 550).
  // Ça évite d'envoyer n'importe quoi à l'API (ex: ?film=abc ou ?film=../)
  if (!/^\d+$/.test(idBrut)) {
    idInvalide();
    return;
  }

  resultat.innerHTML = '<p class="text-center text-zinc-400">Chargement du film… 🍿</p>';

  try {
    // Endpoint /movie/ID : renvoie UN film précis (même champs que discover)
    const url = `https://api.themoviedb.org/3/movie/${idBrut}?api_key=${API_KEY}&language=fr-FR`;
    const reponse = await fetch(url);

    // 404 = ce film n'existe pas dans TMDB
    if (reponse.status === 404) {
      idInvalide();
      return;
    }
    if (!reponse.ok) {
      throw new Error("Erreur TMDB : " + reponse.status);
    }

    const film = await reponse.json();

    // false = l'URL contient déjà ?film=ID, inutile de la modifier
    afficherFilm(film, false);
  } catch (erreur) {
    console.error(erreur);
    resultat.innerHTML =
      '<p class="text-center text-red-400">Impossible de charger ce film. Vérifie ta connexion ou réessaie.</p>';
  }
}

// Cas "ID invalide ou inconnu" : message + on nettoie l'URL
function idInvalide() {
  resultat.innerHTML =
    '<p class="text-center text-zinc-400">Ce film est introuvable 😕 Le lien est peut-être incorrect. Choisis une humeur ci-dessus !</p>';
  // replaceState remplace l'URL actuelle (sans ajouter d'entrée dans l'historique)
  // On retire ?film=... pour revenir à l'adresse normale du site
  try {
    history.replaceState(null, "", window.location.pathname);
  } catch (e) {
    console.log("Impossible de modifier l'URL", e);
  }
}

// ============================================================
// 4. AFFICHAGE DE LA CARTE FILM
// 2e paramètre : mettreAJourUrl (true = ajoute ?film=ID dans la barre d'adresse)
// ============================================================
function afficherFilm(film, mettreAJourUrl) {
  // Met à jour l'URL sans recharger la page
  if (mettreAJourUrl) {
    try {
      // pushState(état, titre (ignoré), nouvelle URL)
      // Le bouton "Retour" du navigateur ramènera donc au film précédent
      history.pushState({ film: film.id }, "", "?film=" + film.id);
    } catch (e) {
      // Peut échouer si tu ouvres le fichier en local (file://) : pas grave
      console.log("pushState indisponible", e);
    }
  }

  const affiche = film.poster_path
    ? "https://image.tmdb.org/t/p/w500/" + film.poster_path
    : "";

  const note = film.vote_average ? film.vote_average.toFixed(1) : "—";
  const synopsis = film.overview || "Pas de synopsis disponible.";

  // Remplace tout le contenu : l'ancienne carte et l'ancien bouton disparaissent
  resultat.innerHTML = `
    <article class="carte-film">
      ${affiche ? `<img src="${affiche}" alt="Affiche de ${film.title}" class="w-full" />` : ""}
      <div class="space-y-3 p-5">
        <h2 class="text-2xl font-bold">${film.title}</h2>
        <p class="font-semibold text-amber-400">⭐ ${note} / 10</p>
        <p class="text-sm leading-relaxed text-zinc-300">${synopsis}</p>
        <div id="actions" class="flex flex-col gap-2 pt-2"></div>
      </div>
    </article>
  `;

  const actions = document.getElementById("actions");

  // --- Bouton "Un autre film" ---
  const ancien = document.getElementById("btn-autre");
  if (ancien) ancien.remove(); // anti-doublon

  const boutonAutre = document.createElement("button");
  boutonAutre.id = "btn-autre";
  boutonAutre.textContent = "🎲 Un autre film";
  boutonAutre.className =
    "rounded-xl bg-zinc-800 px-4 py-3 font-semibold hover:bg-zinc-700";
  boutonAutre.addEventListener("click", chercherFilm);
  actions.appendChild(boutonAutre);

  // Une ligne avec 2 boutons côte à côte (flex = en ligne, flex-1 = même largeur)
  const ligne = document.createElement("div");
  ligne.className = "flex gap-2";
  actions.appendChild(ligne);

  // --- Bouton "Partager ce film" ---
  const boutonPartager = document.createElement("button");
  boutonPartager.id = "btn-partager";
  boutonPartager.textContent = "📤 Partager";
  boutonPartager.className =
    "flex-1 rounded-xl border border-zinc-700 px-4 py-3 font-semibold hover:bg-zinc-800";
  boutonPartager.addEventListener("click", () =>
    partagerFilm(film.title, film.id, boutonPartager)
  );
  ligne.appendChild(boutonPartager);

  // --- Bouton "Copier le lien" ---
  const boutonCopier = document.createElement("button");
  boutonCopier.id = "btn-copier";
  boutonCopier.textContent = "🔗 Copier le lien";
  boutonCopier.className =
    "flex-1 rounded-xl border border-zinc-700 px-4 py-3 font-semibold hover:bg-zinc-800";
  boutonCopier.addEventListener("click", () => copierLien(film.id, boutonCopier));
  ligne.appendChild(boutonCopier);
}

// ============================================================
// Lien du film (utilisé par "Copier le lien")
// ============================================================
function lienDuFilm(id) {
  return window.location.origin + window.location.pathname + "?film=" + id;
}

// Copie UNIQUEMENT l'URL (sans texte) dans le presse-papier
async function copierLien(id, bouton) {
  const labelInitial = bouton.textContent;
  try {
    await navigator.clipboard.writeText(lienDuFilm(id));
    bouton.textContent = "Lien copié !";
  } catch (erreur) {
    // Refusé par le navigateur (ex: page non sécurisée en http)
    console.log("Copie impossible", erreur);
    bouton.textContent = "Copie impossible";
  }
  setTimeout(() => (bouton.textContent = labelInitial), 2000);
}

// ============================================================
// 5. PARTAGE (le lien contient maintenant l'ID du film)
// ============================================================
async function partagerFilm(titre, id, bouton) {
  const texte = `Je viens de trouver ${titre} sur Quel film ce soir ? 🎬`;
  // On construit le lien proprement : adresse du site + ?film=ID
  // (origin = https://monsite.netlify.app, pathname = chemin de la page)
  const url = window.location.origin + window.location.pathname + "?film=" + id;

  try {
    if (navigator.share) {
      await navigator.share({ title: "Quel film ce soir ?", text: texte, url: url });
    } else {
      await navigator.clipboard.writeText(texte + " " + url);
      const labelInitial = bouton.textContent;
      bouton.textContent = "Copié !";
      setTimeout(() => (bouton.textContent = labelInitial), 2000);
    }
  } catch (erreur) {
    console.log("Partage annulé ou impossible", erreur);
  }
}

// ============================================================
// 6. DÉMARRAGE
// ============================================================

// Clic sur le bouton principal
boutonTrouver.addEventListener("click", chercherFilm);

// Au chargement de la page : y a-t-il un ?film=ID dans l'URL ?
chargerFilmDepuisUrl();

// Bouton "Retour"/"Avancer" du navigateur : l'URL change sans recharger la page,
// donc on relit l'URL pour réafficher le bon film (ou la page vide)
window.addEventListener("popstate", chargerFilmDepuisUrl);
