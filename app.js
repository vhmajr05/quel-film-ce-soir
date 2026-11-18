// ============================================================
// 1. CONFIGURATION
// ============================================================
// Ta clé TMDB (themoviedb.org > Paramètres > API). À remplir toi-même.
const API_KEY = "TA_CLE";
const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/";

// Humeur -> [libellé, identifiant(s) de genre TMDB]. "18|36" = Drame OU Histoire (approximation d'« Inspiration »)
const MOODS = {
  comedie: ["😂 Comédie", "35"], romance: ["❤️ Romance", "10749"], horreur: ["😱 Horreur", "27"],
  action: ["💥 Action", "28"], drame: ["🎭 Drame", "18"], scifi: ["🚀 Science-fiction", "878"],
  aventure: ["🧭 Aventure", "12"], thriller: ["🔪 Thriller", "53"], animation: ["🎨 Animation", "16"],
  inspiration: ["🌟 Inspiration", "18|36"],
};

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Sécurité : toute donnée venant de TMDB passe par esc() avant d'entrer dans le HTML
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const cache = new Map();   // évite de refaire les mêmes requêtes
const vus = new Set();     // films déjà proposés (évite les répétitions)

// Appel TMDB avec cache. 404 -> erreur avec status 404
async function tmdb(path, params = {}) {
  const q = new URLSearchParams({ api_key: API_KEY, language: "fr-FR", ...params }).toString();
  const cle = path + "?" + q;
  if (cache.has(cle)) return cache.get(cle);
  const rep = await fetch(API + path + "?" + q);
  if (!rep.ok) { const e = new Error("TMDB " + rep.status); e.status = rep.status; throw e; }
  const data = await rep.json();
  cache.set(cle, data);
  return data;
}

// ============================================================
// 2. FAVORIS (localStorage, protégé par try/catch)
// ============================================================
const lireFavs = () => { try { return JSON.parse(localStorage.getItem("qfcs_favs")) || []; } catch { return []; } };
const ecrireFavs = (a) => { try { localStorage.setItem("qfcs_favs", JSON.stringify(a)); } catch (e) { console.log(e); } };
const estFav = (id) => lireFavs().some((f) => f.id === id);
function basculerFav(f) { // renvoie true si le film vient d'être ajouté
  const a = lireFavs(), i = a.findIndex((x) => x.id === f.id);
  if (i >= 0) a.splice(i, 1); else a.push({ id: f.id, title: f.title, poster_path: f.poster_path });
  ecrireFavs(a);
  return i < 0;
}

// ============================================================
// 3. AFFICHAGE : mini-cartes, carte détaillée
// ============================================================
function mini(f) {
  const img = f.poster_path
    ? `<img loading="lazy" src="${IMG}w342${esc(f.poster_path)}" alt="Affiche de ${esc(f.title)}">`
    : '<div class="sans-affiche">🎬</div>';
  return `<button class="mini" data-id="${Number(f.id)}">${img}<span>${esc(f.title)}</span></button>`;
}
const msg = (el, texte, erreur) => { el.innerHTML = `<p class="msg${erreur ? " erreur" : ""}">${esc(texte)}</p>`; };
const lienDuFilm = (id) => location.origin + location.pathname + "?film=" + id;

// Affiche la fiche complète. mettreAJourUrl=true -> ajoute ?film=ID (pushState)
function afficherFilm(film, mettreAJourUrl) {
  if (mettreAJourUrl) {
    try { history.pushState({ film: film.id }, "", "?film=" + film.id); } catch (e) { console.log(e); }
  }
  document.title = film.title + " — Quel film ce soir ?";
  const h = film.runtime ? `${Math.floor(film.runtime / 60)}h${String(film.runtime % 60).padStart(2, "0")}` : "";
  const real = film.credits?.crew?.find((c) => c.job === "Director")?.name;
  const cast = (film.credits?.cast || []).slice(0, 5).map((c) => c.name).join(", ");
  const bande = film.videos?.results?.find((v) => v.site === "YouTube" && v.type === "Trailer");
  const genres = (film.genres || []).map((g) => g.name).join(" · ");
  const meta = [film.release_date ? film.release_date.slice(0, 4) : "", h, genres].filter(Boolean).join(" · ");
  const affiche = film.poster_path
    ? `<img src="${IMG}w500${esc(film.poster_path)}" alt="Affiche de ${esc(film.title)}">`
    : '<div class="sans-affiche">🎬</div>';

  $("resultat").innerHTML = `
    <article class="carte-film">
      <div class="affiche">${affiche}</div>
      <div class="infos">
        <h2>${esc(film.title)}</h2>
        ${film.original_title && film.original_title !== film.title ? `<p class="original">Titre original : ${esc(film.original_title)}</p>` : ""}
        <p class="note">⭐ ${film.vote_average ? film.vote_average.toFixed(1) + " / 10" : "Pas encore noté"}</p>
        ${meta ? `<p class="meta">${esc(meta)}</p>` : ""}
        <p class="synopsis">${esc(film.overview || "Pas de synopsis disponible.")}</p>
        ${real ? `<p class="meta">Réalisation : ${esc(real)}</p>` : ""}
        ${cast ? `<p class="meta">Avec : ${esc(cast)}</p>` : ""}
        <div class="actions">
          <button class="btn-ghost" id="btn-fav"></button>
          <button class="btn-ghost" id="btn-partager">📤 Partager</button>
          <button class="btn-ghost" id="btn-copier">🔗 Copier le lien</button>
          ${bande ? `<a class="btn-ghost" target="_blank" rel="noopener noreferrer" href="https://www.youtube.com/watch?v=${encodeURIComponent(bande.key)}">▶ Bande-annonce</a>` : ""}
          <button class="btn-ghost" id="btn-autre">🎲 Un autre film</button>
        </div>
      </div>
    </article>`;

  const majFav = () => ($("btn-fav").textContent = estFav(film.id) ? "♥ Dans mes favoris" : "♡ Ajouter aux favoris");
  majFav();
  $("btn-fav").onclick = () => { basculerFav(film); majFav(); };
  $("btn-partager").onclick = (e) => partagerFilm(film.title, film.id, e.currentTarget);
  $("btn-copier").onclick = (e) => copierLien(film.id, e.currentTarget);
  $("btn-autre").onclick = () => chercherFilm(false);
}

// ============================================================
// 4. RECOMMANDATION (humeur + filtres) et MODE SURPRISE
// ============================================================
function lireFiltres() {
  const p = { sort_by: "popularity.desc", "vote_count.gte": "100" };
  p.with_genres = MOODS[$("humeur").value][1];
  if ($("duree").value) p["with_runtime.lte"] = $("duree").value;
  if ($("annee").value) p["primary_release_date.gte"] = $("annee").value + "-01-01";
  if ($("note").value) p["vote_average.gte"] = $("note").value;
  if ($("langue").value) p.with_original_language = $("langue").value;
  return p;
}

async function chercherFilm(surprise = false) {
  vue("accueil");
  const zone = $("resultat");
  zone.scrollIntoView({ block: "start" });
  zone.innerHTML = surprise
    ? '<div class="surprise"><div class="bobine">🎞️</div><p>Le film parfait arrive…</p></div>'
    : '<div class="carte-film squelette"></div>';
  try {
    // Surprise : on ignore les filtres et on pioche large parmi les films bien notés
    const p = surprise ? { sort_by: "popularity.desc", "vote_count.gte": "500", "vote_average.gte": "6.5" } : lireFiltres();
    p.page = 1 + Math.floor(Math.random() * (surprise ? 10 : 3));
    let [d] = await Promise.all([tmdb("/discover/movie", p), surprise ? sleep(1800) : null]);
    if (!d.results.length && p.page > 1) d = await tmdb("/discover/movie", { ...p, page: 1 });

    let liste = d.results.filter((f) => f.poster_path);
    if (!liste.length) return msg(zone, "Aucun film trouvé 😕 Essaie d'assouplir les filtres.");
    let neufs = liste.filter((f) => !vus.has(f.id));
    if (!neufs.length) { vus.clear(); neufs = liste; } // tout vu : on repart de zéro
    const choix = neufs[Math.floor(Math.random() * neufs.length)];
    vus.add(choix.id);
    afficherFilm(await detail(choix.id), true);
  } catch (e) {
    console.error(e);
    msg(zone, "Impossible de charger un film. Vérifie ta clé API et ta connexion.", true);
  }
}
const detail = (id) => tmdb("/movie/" + id, { append_to_response: "credits,videos", include_video_language: "fr,en,null" });

// ============================================================
// 5. LIEN PARTAGEABLE ?film=ID
// ============================================================
async function chargerFilmDepuisUrl() {
  const id = new URLSearchParams(location.search).get("film");
  if (id === null) { $("resultat").innerHTML = ""; document.title = "Quel film ce soir ? — Ton film trouvé en deux clics"; return; }
  if (!/^\d+$/.test(id)) return idInvalide();
  $("resultat").innerHTML = '<div class="carte-film squelette"></div>';
  try {
    afficherFilm(await detail(id), false);
  } catch (e) {
    if (e.status === 404) return idInvalide();
    console.error(e);
    msg($("resultat"), "Impossible de charger ce film. Réessaie dans un instant.", true);
  }
}
function idInvalide() {
  msg($("resultat"), "Ce film est introuvable 😕 Le lien est peut-être incorrect.");
  try { history.replaceState(null, "", location.pathname); } catch (e) { console.log(e); }
}

async function partagerFilm(titre, id, bouton) {
  const texte = `Je viens de trouver ${titre} sur Quel film ce soir ? 🎬`;
  const url = lienDuFilm(id);
  try {
    if (navigator.share) await navigator.share({ title: "Quel film ce soir ?", text: texte, url });
    else await copierLien(id, bouton, texte + " ");
  } catch (e) { console.log("Partage annulé", e); }
}
async function copierLien(id, bouton, prefixe = "") {
  const label = bouton.textContent;
  try { await navigator.clipboard.writeText(prefixe + lienDuFilm(id)); bouton.textContent = "Lien copié !"; }
  catch (e) { console.log(e); bouton.textContent = "Copie impossible"; }
  setTimeout(() => (bouton.textContent = label), 2000);
}

// ============================================================
// 6. NAVIGATION ENTRE LES VUES
// ============================================================
let explorerCharge = false;
function vue(nom) {
  document.querySelectorAll(".vue").forEach((s) => (s.hidden = s.id !== "vue-" + nom));
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("actif", b.dataset.vue === nom));
  if (nom === "favoris") {
    const f = lireFavs();
    if (f.length) $("grille-favs").innerHTML = f.map(mini).join("");
    else msg($("grille-favs"), "Aucun favori pour l'instant. Ajoute-en depuis une fiche film ♡");
  }
  if (nom === "explorer" && !explorerCharge) { explorerCharge = true; explorer(true); }
}

// ============================================================
// 7. RANGÉES DE L'ACCUEIL ET EXPLORATION
// ============================================================
async function rangee(id, path, params) {
  try { $(id).innerHTML = (await tmdb(path, params)).results.slice(0, 15).map(mini).join(""); }
  catch (e) { console.error(e); msg($(id), "Impossible de charger cette sélection.", true); }
}

const ex = { page: 1 };
async function explorer(reset) {
  if (reset) { ex.page = 1; $("grille").innerHTML = ""; }
  const q = $("q").value.trim();
  let path = "/discover/movie", p = { page: ex.page };
  if (q) { path = "/search/movie"; p.query = q; }
  else {
    const cat = $("cat").value;
    if ($("genre").value) p.with_genres = $("genre").value;
    p.sort_by = "popularity.desc";
    if (cat === "mieux") Object.assign(p, { sort_by: "vote_average.desc", "vote_count.gte": "1000" });
    if (cat === "recents") Object.assign(p, { "primary_release_date.gte": new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10), "vote_count.gte": "20" });
    if (cat === "pepites") Object.assign(p, { sort_by: "vote_average.desc", "vote_count.gte": "300", "vote_count.lte": "2000", "vote_average.gte": "7.3" });
  }
  try {
    const d = await tmdb(path, p);
    if (!d.results.length && ex.page === 1) msg($("grille"), "Aucun résultat.");
    else $("grille").insertAdjacentHTML("beforeend", d.results.map(mini).join(""));
    $("plus").hidden = ex.page >= d.total_pages;
  } catch (e) { console.error(e); msg($("grille"), "Impossible de charger les films.", true); }
}

// ============================================================
// 8. DÉMARRAGE
// ============================================================
$("humeur").innerHTML = Object.entries(MOODS).map(([k, [l]]) => `<option value="${k}">${l}</option>`).join("");
$("genre").innerHTML = '<option value="">Tous</option>' + Object.values(MOODS).map(([l, g]) => `<option value="${g}">${l}</option>`).join("");
$("chips").innerHTML = Object.entries(MOODS).map(([k, [l]]) => `<button class="chip" data-humeur="${k}">${l}</button>`).join("");

$("btn-trouver").addEventListener("click", () => chercherFilm(false));
$("btn-surprise").addEventListener("click", () => chercherFilm(true));
$("plus").addEventListener("click", () => { ex.page++; explorer(false); });
["cat", "genre"].forEach((id) => $(id).addEventListener("change", () => explorer(true)));
let minuterie;
$("q").addEventListener("input", () => { clearTimeout(minuterie); minuterie = setTimeout(() => explorer(true), 400); });

// Un seul écouteur pour tous les clics : navigation, chips, ouverture d'une affiche
document.addEventListener("click", async (e) => {
  const nav = e.target.closest("[data-vue]");
  if (nav) return vue(nav.dataset.vue);
  const chip = e.target.closest("[data-humeur]");
  if (chip) { $("humeur").value = chip.dataset.humeur; return chercherFilm(false); }
  const carte = e.target.closest(".mini[data-id]");
  if (carte) {
    vue("accueil");
    $("resultat").scrollIntoView({ block: "start" });
    $("resultat").innerHTML = '<div class="carte-film squelette"></div>';
    try { afficherFilm(await detail(carte.dataset.id), true); }
    catch (err) { console.error(err); msg($("resultat"), "Impossible de charger ce film.", true); }
  }
});

window.addEventListener("popstate", chargerFilmDepuisUrl);

rangee("row-populaires", "/movie/popular");
rangee("row-pepites", "/discover/movie", { sort_by: "vote_average.desc", "vote_count.gte": "300", "vote_count.lte": "2000", "vote_average.gte": "7.3" });
rangee("row-tendances", "/trending/movie/week");
chargerFilmDepuisUrl();
