// ============================================================
// 1. CONFIGURATION
// ============================================================
// Ta clé TMDB (themoviedb.org > Paramètres > API). À remplir toi-même.
const API_KEY = "5b2274f7cda860714b6c3c5077e38568";
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
  const annee = f.release_date ? f.release_date.slice(0, 4) : ""; // absent des favoris : on n'invente rien
  const img = f.poster_path
    ? `<img loading="lazy" src="${IMG}w342${esc(f.poster_path)}" alt="Affiche de ${esc(f.title)}" class="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105">`
    : '<div class="absolute inset-0 grid place-items-center bg-zinc-800 text-3xl">🎬</div>';
  return `<button class="mini group relative block aspect-[2/3] snap-start overflow-hidden rounded-2xl bg-zinc-900 text-left shadow-lg shadow-black/50" data-id="${Number(f.id)}">
    ${img}
    <span class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-12">
      <b class="block text-sm font-semibold leading-tight text-white">${esc(f.title)}</b>
      ${annee ? `<small class="text-xs text-zinc-300">${esc(annee)}</small>` : ""}
    </span></button>`;
}
const msg = (el, texte, erreur) => { el.innerHTML = `<p class="msg${erreur ? " erreur" : ""}">${esc(texte)}</p>`; };
const lienDuFilm = (id) => location.origin + location.pathname + "?film=" + id;

// Affiche la fiche complète. mettreAJourUrl=true -> ajoute ?film=ID (pushState)
function afficherFilm(film, mettreAJourUrl) {
  immersif(true); // menus repliés : toute la place à la fiche (aussi pour un lien ?film=ID)
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

  const fond = film.backdrop_path ? `<div class="fond" style="background-image:url('${IMG}w780${esc(film.backdrop_path)}')"></div>` : "";
  $("resultat").innerHTML = `
    <article class="carte-film">
      ${fond}<button id="btn-retour" class="retour" aria-label="Retour">←</button>
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
          <button class="btn-stream" id="btn-ou" aria-expanded="false" aria-controls="ou-regarder">📺 Où regarder ?</button>
          <button class="btn-gold" id="btn-copier">🔗 Copier le lien</button>
          <button class="btn-discret" id="btn-partager">📤 Partager</button>
          <button class="btn-autre" id="btn-autre">🎲 Un autre film</button>
          <button class="btn-discret" id="btn-fav"></button>
          ${bande ? `<a class="btn-discret" target="_blank" rel="noopener noreferrer" href="https://www.youtube.com/watch?v=${encodeURIComponent(bande.key)}">▶ Bande-annonce</a>` : ""}
        </div>
        <section id="ou-regarder" class="ou" data-film="${Number(film.id)}" hidden><p class="meta">Recherche des plateformes…</p></section>
      </div>
    </article>`;

  const majFav = () => ($("btn-fav").textContent = estFav(film.id) ? "♥ Dans mes favoris" : "♡ Ajouter aux favoris");
  majFav();
  $("btn-fav").onclick = () => { basculerFav(film); majFav(); };
  $("btn-partager").onclick = (e) => partagerFilm(film.title, film.id, e.currentTarget);
  $("btn-copier").onclick = (e) => copierLien(film.id, e.currentTarget);
  $("btn-retour").onclick = retour;
  $("btn-autre").onclick = () => chercherFilm(dernierMode);
  $("btn-ou").onclick = (e) => {
    const zone = $("ou-regarder"), ouvrir = zone.hidden;
    zone.hidden = !ouvrir;
    e.currentTarget.setAttribute("aria-expanded", String(ouvrir));
    if (ouvrir && !zone.dataset.charge) { zone.dataset.charge = "1"; chargerPlateformes(film.id); } // 1 seul appel par fiche
    if (ouvrir) zone.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
}

// ============================================================
// 3b. OÙ REGARDER CE FILM ? (TMDB /watch/providers, données JustWatch)
// ============================================================
//#debut-plateformes
const PAYS = { SN: "🇸🇳 Sénégal", FR: "🇫🇷 France" };
// [clé TMDB, titre affiché] : les 5 types de disponibilité
const TYPES = [["flatrate", "Streaming par abonnement"], ["rent", "Location"], ["buy", "Achat"], ["free", "Gratuit"], ["ads", "Gratuit avec publicité"]];
// Pays mémorisé (Sénégal par défaut)
let pays = (() => { try { const p = localStorage.getItem("qfcs_pays"); return PAYS[p] ? p : "SN"; } catch { return "SN"; } })();

function carteFournisseur(p) {
  const logo = p.logo_path ? `<img loading="lazy" src="${IMG}w92${esc(p.logo_path)}" alt="">` : `<span class="logo-vide">${esc(p.provider_name[0])}</span>`;
  return `<div class="fournisseur">${logo}<span>${esc(p.provider_name)}</span></div>`;
}

// Affiche les disponibilités du pays choisi (et UNIQUEMENT de ce pays)
function rendrePlateformes(zone, id, results) {
  const d = results[pays]; // undefined si TMDB n'a rien pour ce pays
  const groupes = d ? TYPES.map(([cle, titre]) => [titre, Array.isArray(d[cle]) ? d[cle].filter((p) => p && p.provider_name) : []]).filter(([, l]) => l.length) : [];
  // Le lien "options de visionnage" est celui fourni par TMDB, jamais construit à la main
  const lien = groupes.length && d && /^https:\/\/www\.themoviedb\.org\//.test(d.link || "") ? d.link : "";
  const options = Object.entries(PAYS).map(([c, l]) => `<option value="${c}"${c === pays ? " selected" : ""}>${l}</option>`).join("");
  zone.innerHTML = `
    <div class="ou-tete"><h3>Où regarder ce film ?</h3><select id="pays" aria-label="Pays">${options}</select></div>
    ${groupes.length
      ? groupes.map(([t, l]) => `<div class="ou-type"><p class="ou-titre">${esc(t)}</p><div class="ou-liste">${l.map(carteFournisseur).join("")}</div></div>`).join("")
      : '<p class="meta">Aucune disponibilité en streaming référencée dans ce pays pour le moment.</p>'}
    <div class="ou-liens">
      ${lien ? `<a class="btn-or" href="${esc(lien)}" target="_blank" rel="noopener noreferrer">Voir les options de visionnage</a>` : ""}
      <a class="btn-ghost" href="https://www.themoviedb.org/movie/${Number(id)}" target="_blank" rel="noopener noreferrer">En savoir plus sur TMDB</a>
    </div>
    <p class="credit">Données de disponibilité fournies par JustWatch.</p>`;
  $("pays").onchange = (e) => {
    pays = e.target.value;
    try { localStorage.setItem("qfcs_pays", pays); } catch (err) { console.log(err); }
    chargerPlateformes(id); // réponse déjà en cache : pas de nouvelle requête
  };
}

async function chargerPlateformes(id) {
  const zone = $("ou-regarder");
  if (!zone) return;
  zone.dataset.film = id;
  // Si l'utilisateur a changé de film entre-temps, on n'écrit pas dans la mauvaise fiche
  const actuel = () => zone.isConnected && zone.dataset.film == id;
  try {
    const data = await tmdb(`/movie/${id}/watch/providers`); // mis en cache par tmdb()
    if (!data || typeof data.results !== "object" || data.results === null) throw new Error("Réponse invalide");
    if (actuel()) rendrePlateformes(zone, id, data.results);
  } catch (e) {
    console.error(e);
    if (actuel()) { delete zone.dataset.charge; zone.innerHTML = '<p class="meta">Impossible de récupérer les plateformes actuellement.</p>'; }
  }
}
//#fin-plateformes

// ============================================================
// 4. RECOMMANDATION (humeur + filtres) et MODE SURPRISE
// ============================================================
function filtresCommuns() {
  const p = {}, m = MOODS[$("humeur").value];
  if (m) p.with_genres = m[1];
  if ($("duree").value) p["with_runtime.lte"] = $("duree").value;
  if ($("annee").value) p["primary_release_date.gte"] = $("annee").value + "-01-01";
  if ($("note").value) p["vote_average.gte"] = $("note").value;
  if ($("langue").value) p.with_original_language = $("langue").value;
  return p;
}
const lireFiltres = () => ({ sort_by: "popularity.desc", "vote_count.gte": "100", ...filtresCommuns() });

let dernierMode = false; // true si la dernière recherche était "Surprends-moi"
async function chercherFilm(surprise = false) {
  dernierMode = surprise;
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
  if (id === null) { immersif(false); $("resultat").innerHTML = ""; document.title = "Quel film ce soir ? — Ton film trouvé en deux clics"; return; }
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
  immersif(false);
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
// Mode immersif : replie (true) ou déplie (false) les critères avec une animation CSS
function immersif(on) {
  $("btn-criteres").hidden = !on; // visible quand une fiche film est affichée
}

let explorerCharge = false;
function vue(nom) {
  document.querySelectorAll(".vue").forEach((s) => (s.hidden = s.id !== "vue-" + nom));
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("actif", b.dataset.vue === nom));
  if (nom === "favoris") {
    const f = lireFavs();
    if (f.length) $("grille-favs").innerHTML = f.map(mini).join("");
    else msg($("grille-favs"), "Aucun favori pour l'instant. Ajoute-en depuis une fiche film ♡");
  }
  if (nom === "recherche") { if (!$("grille-recherche").innerHTML) rechercher(true); $("q").focus(); }
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
  const p = { page: ex.page, sort_by: "popularity.desc", ...filtresCommuns() };
  const cat = $("cat").value;
  if (cat === "mieux") Object.assign(p, { sort_by: "vote_average.desc", "vote_count.gte": "1000" });
  if (cat === "recents") Object.assign(p, { "primary_release_date.gte": new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10), "vote_count.gte": "20" });
  if (cat === "pepites") Object.assign(p, { sort_by: "vote_average.desc", "vote_count.gte": "300", "vote_count.lte": "2000", "vote_average.gte": String(Math.max(7.3, Number($("note").value) || 0)) });
  try {
    const d = await tmdb("/discover/movie", p);
    if (!d.results.length && ex.page === 1) msg($("grille"), "Aucun film ne correspond à ces filtres.");
    else $("grille").insertAdjacentHTML("beforeend", d.results.map(mini).join(""));
    $("plus").hidden = ex.page >= d.total_pages;
  } catch (e) { console.error(e); msg($("grille"), "Impossible de charger les films.", true); }
}

// Recherche par titre (onglet dédié)
const rech = { page: 1 };
async function rechercher(reset) {
  const q = $("q").value.trim(), zone = $("grille-recherche");
  if (reset) { rech.page = 1; zone.innerHTML = ""; $("plus-recherche").hidden = true; }
  if (!q) return msg(zone, "Tape le titre d'un film pour lancer la recherche.");
  try {
    const d = await tmdb("/search/movie", { query: q, page: rech.page });
    if (q !== $("q").value.trim()) return; // l'utilisateur a retapé entre-temps : on ignore cette réponse
    if (!d.results.length && rech.page === 1) msg(zone, "Aucun film trouvé pour « " + q + " ».");
    else zone.insertAdjacentHTML("beforeend", d.results.map(mini).join(""));
    $("plus-recherche").hidden = rech.page >= d.total_pages;
  } catch (e) { console.error(e); msg(zone, "Impossible de lancer la recherche. Réessaie.", true); }
}

// Retour depuis une fiche film
function retour() {
  if (history.state && history.state.film) return history.back(); // popstate recharge l'état précédent
  try { history.replaceState(null, "", location.pathname); } catch (e) { console.log(e); }
  chargerFilmDepuisUrl(); // plus de ?film= : retour à l'accueil normal
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================
// 8. DÉMARRAGE
// ============================================================
$("humeur").innerHTML = '<option value="">Tous les genres</option>' + Object.entries(MOODS).map(([k, [l]]) => `<option value="${k}">${l}</option>`).join("");
$("chips").innerHTML = Object.entries(MOODS).map(([k, [l]]) => `<button class="chip" data-humeur="${k}">${l}</button>`).join("");

$("btn-trouver").addEventListener("click", () => chercherFilm(false));
$("btn-criteres").addEventListener("click", () => {
  vue("explorer"); // les critères sont dans l'onglet Explorer
  $("criteres").scrollIntoView({ behavior: "smooth", block: "start" });
});
$("btn-surprise").addEventListener("click", () => chercherFilm(true));
$("plus").addEventListener("click", () => { ex.page++; explorer(false); });
$("btn-appliquer").addEventListener("click", () => explorer(true));
$("btn-reset").addEventListener("click", () => {
  ["humeur", "duree", "annee", "note", "langue"].forEach((id) => ($(id).value = ""));
  $("cat").value = "populaires";
  explorer(true);
});
$("plus-recherche").addEventListener("click", () => { rech.page++; rechercher(false); });
let minuterie;
$("q").addEventListener("input", () => { clearTimeout(minuterie); minuterie = setTimeout(() => rechercher(true), 400); });

// Un seul écouteur pour tous les clics : navigation, chips, ouverture d'une affiche
document.addEventListener("click", async (e) => {
  const fl = e.target.closest("[data-defile]");
  if (fl) {
    const c = fl.parentElement.querySelector(".carrousel");
    return c.scrollBy({ left: Number(fl.dataset.defile) * c.clientWidth * 0.8, behavior: "smooth" });
  }
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
