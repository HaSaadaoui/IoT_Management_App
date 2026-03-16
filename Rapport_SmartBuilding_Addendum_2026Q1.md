# Projet Smart Building — Addendum (Janvier → Mars 2026)

Ce document est un addendum à ajouter au rapport existant « Projet Smart Building : Livrable 1.0 ». Il regroupe les travaux réalisés sur les ~3 derniers mois qui ne sont pas encore décrits dans le document principal.

> Remarque : les sections ci-dessous sont rédigées pour être copiées/collées dans le rapport. Des emplacements sont prévus pour insérer des captures d’écran et des schémas explicatifs.

---

## Emplacements recommandés pour les captures et schémas

Afin de garder un document lisible, je prévois de stocker les images dans un dossier dédié, par exemple :

`docs/rapport/assets/2026Q1/`

Chaque figure ci-dessous contient :

- un **titre de figure**
- un **chemin suggéré** (modifiable)
- une **phrase de description** à conserver dans le rapport

---

## 3.5 Stabilisation et industrialisation du déploiement Azure (Docker Compose / images / environnements)

### Objectif
Au cours de cette période, mon objectif a été d’améliorer la robustesse du déploiement en environnement Azure et de réduire les écarts de comportement entre les branches (develop/main). L’enjeu principal était de rendre l’exécution plus reproductible, en s’appuyant sur une approche conteneurisée et une configuration externalisée.

### Implémentation
J’ai consolidé le fonctionnement du déploiement via Docker Compose en vérifiant les images réellement exécutées, les versions utilisées par branche, ainsi que la cohérence de la configuration injectée au runtime (variables d’environnement, URLs inter-services, paramètres de base de données). J’ai également structuré une démarche de validation basée sur des tests simples (vérification des ports exposés, health-checks manuels par requêtes HTTP, analyse des logs), afin d’identifier rapidement si un incident était lié au code, à l’image Docker ou à l’infrastructure.

### Détails techniques / architecture
L’application s’exécute dans un écosystème de services conteneurisés, avec une séparation des responsabilités entre le backend principal et un service de monitoring. Cette architecture impose une attention particulière à : la configuration réseau interne (URLs entre conteneurs), l’exposition des ports côté VM, et l’utilisation d’un registre d’images (y compris local) pour éviter des builds “à la main” sur la VM.

### Interface utilisateur
L’effet direct de cette stabilisation est une amélioration de la disponibilité de l’application : les pages de login et les écrans de gestion deviennent accessibles de manière fiable, et les fonctionnalités dépendantes des services internes (monitoring, synchronisation) se comportent plus predictiblement.

### Valeur ajoutée
Cette étape rapproche le projet de pratiques d’industrialisation attendues dans un contexte cloud : déploiements reproductibles, diagnostic facilité par service, et réduction des effets de bord entre environnements.

#### Emplacement capture / schéma
**Figure 1 — Architecture de déploiement Docker Compose (services + ports + dépendances)**

- Chemin suggéré : `docs/rapport/assets/2026Q1/fig1_docker_compose_architecture.png`
- Description : Schéma représentant les services (application, monitoring, registre) et leurs ports exposés, ainsi que les flux HTTP internes.

---

## 3.6 Alignement des schémas de données MySQL entre environnements (cohérence applicative)

### Objectif
L’objectif a été de supprimer les erreurs applicatives causées par des divergences de schéma entre environnements (tables/colonnes manquantes) et de fiabiliser l’historisation des mesures capteurs lors des traitements et synchronisations.

### Implémentation
J’ai comparé les schémas entre environnements afin d’identifier les écarts, puis j’ai complété la base cible avec les tables et structures nécessaires. Une attention particulière a été portée à la table d’historisation des mesures (ex. `sensor_data`) et à l’ajout d’index utiles pour les requêtes de dashboard et d’analytics.

### Détails techniques / architecture
Cette démarche s’inscrit dans la continuité de l’évolution du projet vers une base managée (MySQL, puis potentiellement PostgreSQL). Elle implique de maîtriser la compatibilité des types (dates, identifiants, types de valeurs), de structurer la donnée pour l’agrégation, et de s’assurer que les services Spring Boot (DAO/repositories) restent compatibles sans régression.

### Interface utilisateur
Côté application, cette stabilisation réduit les erreurs visibles (pages qui échouent, historiques incomplets) et sécurise le fonctionnement des écrans d’analyse (dashboard, historiques, tableaux).

### Valeur ajoutée
Ce travail améliore la robustesse globale de la plateforme et garantit une donnée historisée cohérente, indispensable pour l’exploitation analytique à moyen/long terme.

#### Emplacement capture / schéma
**Figure 2 — Comparaison de schémas et correctifs appliqués (extrait)**

- Chemin suggéré : `docs/rapport/assets/2026Q1/fig2_schema_alignment.png`
- Description : Capture montrant un exemple de différence de schéma (table/colonnes manquantes) et la correction correspondante.

---

## 3.7 Enrichissement du Dashboard — “History” (Occupation Rate / Energy Consumption / Environment Analytics)

### Objectif
L’objectif a été de compléter la supervision temps réel par une couche d’analyse historisée, afin d’obtenir des indicateurs utiles au pilotage : taux d’occupation, tendances de consommation énergétique et analyse de confort environnemental.

### Implémentation
J’ai renforcé l’onglet “History” du dashboard en structurant le chargement des données à la demande (filtres, période, bâtiment/étage) et en améliorant la restitution sous forme de graphiques et tableaux. J’ai notamment travaillé sur :

- le calcul et l’affichage de l’**Occupation Rate** à partir d’états d’occupation agrégés sur des périodes
- le suivi **Energy Consumption** via consolidation des mesures énergétiques selon une granularité temporelle adaptée
- l’extension **Environment Analytics** pour analyser des séries temporelles de capteurs d’environnement (ex. CO₂, température), avec cohérence des unités et de la lisibilité

### Détails techniques / architecture
Ces évolutions ont nécessité des agrégations plus avancées côté backend (endpoints dédiés et structuration de la donnée historisée) ainsi que des traitements front-end pour transformer les séries temporelles en visualisations. Une attention particulière a été portée à l’expérience utilisateur (rafraîchissement des graphes, gestion de chargement, cohérence des libellés selon le type de capteur).

### Interface utilisateur
L’utilisateur dispose d’une navigation plus claire dans la partie “History”, avec un déclenchement explicite du chargement, des indicateurs de progression et une restitution lisible (graphiques et tableaux). Cette approche rend l’analyse accessible à un public non technique.

### Valeur ajoutée
La plateforme évolue d’une supervision instantanée vers un outil de décision, permettant de mesurer et comparer l’usage des espaces, la consommation et les conditions environnementales du bâtiment.

#### Emplacement captures
**Figure 3 — Dashboard History : Occupation Rate (graphique + tableau)**

- Chemin suggéré : `docs/rapport/assets/2026Q1/fig3_history_occupation_rate.png`
- Description : Capture de l’onglet History illustrant le taux d’occupation sur une période et le tableau associé.

**Figure 4 — Dashboard History : Energy Consumption**

- Chemin suggéré : `docs/rapport/assets/2026Q1/fig4_history_energy_consumption.png`
- Description : Capture de la section consommation énergétique et d’un exemple de consolidation temporelle.

**Figure 5 — Dashboard History : Environment Analytics (CO₂ / Température, etc.)**

- Chemin suggéré : `docs/rapport/assets/2026Q1/fig5_history_environment_analytics.png`
- Description : Capture montrant l’analyse historisée d’un capteur d’environnement, avec unités et légendes.

---

## 3.8 Résolution d’incidents d’infrastructure (Azure MySQL / réseau VM)

### Objectif
L’objectif a été d’assurer la continuité de service en environnement Azure en diagnostiquant et corrigeant des incidents bloquants affectant l’authentification base de données et l’accès à l’application depuis l’extérieur.

### Implémentation
J’ai analysé les logs applicatifs Spring Boot (notamment la chaîne JDBC/HikariCP lors de l’authentification) pour identifier une configuration Azure MySQL imposant l’authentification Entra ID uniquement, rendant impossible l’accès via des identifiants MySQL classiques. J’ai ensuite proposé l’ajustement de paramétrage côté Azure afin de rétablir une connectivité compatible avec l’application.

Dans un second temps, j’ai investigué un incident réseau sur une VM de test : l’application répondait localement (requêtes sur `localhost`), mais l’accès via l’IP publique expirait. J’ai donc vérifié les règles NSG, l’exposition des ports, l’association IP/NIC et formulé des hypothèses de routage, en distinguant clairement ce qui relève du code et ce qui relève de l’infrastructure.

### Détails techniques / architecture
Cette phase m’a conduit à appliquer une méthodologie de diagnostic : reproduction locale, vérification des ports et du binding, validation des règles de sécurité réseau Azure, puis analyse des composants réseau attachés à la VM. Cette approche est indispensable en contexte cloud car les pannes sont souvent transverses (app + conteneurs + infra).

### Interface utilisateur
Ces corrections conditionnent directement l’accès à l’application (login, dashboard) et donc la capacité à valider fonctionnellement les autres briques (monitoring, analytics, TTN).

### Valeur ajoutée
Cette partie renforce la maturité opérationnelle du projet et ma capacité à diagnostiquer des incidents de bout en bout dans un environnement industrialisé.

#### Emplacement captures
**Figure 6 — Extrait de logs : erreur JDBC / Azure MySQL Entra-only**

- Chemin suggéré : `docs/rapport/assets/2026Q1/fig6_mysql_auth_issue_logs.png`
- Description : Extrait de logs montrant l’erreur de connexion JDBC et la cause (mode Entra-only).

**Figure 7 — Diagnostic réseau : NSG + tests curl local vs IP publique**

- Chemin suggéré : `docs/rapport/assets/2026Q1/fig7_network_diagnosis.png`
- Description : Montage illustrant la règle NSG et les résultats des tests (`curl localhost` OK vs IP publique timeout).

---

## 3.9 Investigation IoT : extraction nulle de métriques (“0 values extracted”) sur certains uplinks TTN

### Objectif
L’objectif a été de comprendre pourquoi certaines remontées TTN ne produisaient aucune métrique exploitable côté application, alors que d’autres devices alimentaient correctement l’historique. Ce sujet est critique pour garantir la fiabilité des indicateurs de supervision et d’analytics.

### Implémentation
J’ai observé les logs du service de synchronisation/traitement lors des uplinks TTN et identifié des cas où le parsing aboutissait à “0 values extracted”. J’ai engagé une démarche de comparaison entre applications TTN et devices, afin d’identifier si la cause provenait d’un format de payload différent (structure `decoded_payload`) ou d’une configuration de mapping capteurs/mesures en base.

### Détails techniques / architecture
Cette investigation s’appuie sur :

- la traçabilité par logs au niveau du service d’extraction
- la comparaison des JSON d’uplink entre devices/applications TTN
- la vérification de la configuration applicative associée aux capteurs (types, mappings de valeurs, conventions de nommage)

### Interface utilisateur
Même si le problème est backend, son impact est visible côté dashboard : des capteurs peuvent apparaître “silencieux” et fausser les indicateurs (occupation, environnement), ce qui justifie un renforcement de la robustesse du parsing.

### Valeur ajoutée
Cette démarche améliore la fiabilité de la chaîne de donnée IoT, condition indispensable pour des analyses pertinentes et une supervision opérationnelle.

#### Emplacement capture
**Figure 8 — Comparaison d'uplinks TTN : payload "OK" vs payload "non extrait"**

- Chemin suggéré : `docs/rapport/assets/2026Q1/fig8_ttn_payload_comparison.png`
- Description : Capture comparant deux `decoded_payload` et mettant en évidence la différence de structure responsable de l'extraction nulle.

---

## 3.10 Redesign des pages d'authentification (Login / Register) — UI/UX moderne

### Objectif
L'objectif a été de repenser entièrement l'interface d'authentification (pages Login et Register) pour offrir une expérience utilisateur moderne, professionnelle et cohérente avec les standards actuels des plateformes SaaS. L'ancien design, fonctionnel mais minimaliste, ne reflétait pas le niveau de qualité du reste de la plateforme Smart Building.

### Implémentation
J'ai conçu et implémenté une page d'authentification unifiée remplaçant les deux anciennes pages séparées (`login.html` et `register.html`). La nouvelle interface repose sur un conteneur central divisé en deux panneaux :

- **Panneau gauche (formulaire)** : affiche le formulaire de connexion par défaut. L'utilisateur peut basculer vers le formulaire d'inscription via un lien ou le bouton du panneau visuel.
- **Panneau droit (visuel)** : un panneau décoratif avec un dégradé aux couleurs Mantu, une illustration SVG animée représentant un bâtiment intelligent avec des capteurs IoT, des particules flottantes et du texte d'accroche contextuel.

Une **animation de glissement (sliding)** fluide permet de passer du formulaire Login au formulaire Register : le panneau visuel glisse d'un côté à l'autre avec un effet de rebond subtil (`cubic-bezier`), tandis que les formulaires se substituent avec des transitions d'opacité et de translation.

### Détails techniques / architecture

**Fichiers créés / modifiés :**
- `src/main/resources/static/css/auth.css` (nouveau) — ~1000 lignes de CSS moderne avec variables CSS, animations keyframes, responsive design complet
- `src/main/resources/templates/login.html` (réécrit) — template Thymeleaf unifié contenant les deux formulaires + panneau visuel + JavaScript inline

**Caractéristiques techniques :**
- **Typographie** : Police Inter (Google Fonts) pour un rendu moderne et lisible
- **Palette** : basée sur les couleurs Mantu (`#662179` violet principal, dégradés vers `#8b2fa3` et `#3a7bd5`)
- **Animations d'entrée** : conteneur (scale-up + fade), logo (slide-down), titres et champs (slide-up séquencé avec délais croissants), boutons (fade-up), illustration (bounce-in + flottement continu)
- **Animations d'interaction** : ripple au focus des inputs, pulse au clic des boutons, underline slide-in sur les liens, glow sur les boutons ghost, shimmer au hover du logo
- **Illustration SVG** : bâtiment avec étages, fenêtres animées (glow), capteurs IoT pulsants, ondes signal, antenne, particules flottantes — le tout en SVG inline avec animations CSS
- **Arrière-plan** : image `mantu-background.jpg` avec overlay gradient semi-transparent, particules ambiantes CSS
- **Sliding** : mécanisme dual-panel classique (overlay à double largeur avec `translateX`) utilisant une courbe `cubic-bezier(0.68, -0.15, 0.27, 1.15)` pour un effet de rebond élégant
- **Validation client** : confirmation de mot de passe avec feedback visuel en temps réel
- **Toggle mot de passe** : affichage temporaire (1.2s) avec icônes SVG eye/eye-off
- **Responsive** : 3 breakpoints (desktop 960px, tablette <900px, mobile <680px) avec empilement vertical sur mobile et masquage des éléments décoratifs secondaires

**Compatibilité backend :**
- Aucune modification du backend Spring Boot ni de la configuration Spring Security
- Les formulaires conservent les mêmes attributs `name` et `th:action` (POST `/login` pour la connexion, POST `/register` pour l'inscription)
- Les messages d'erreur/succès Thymeleaf (`param.error`, `param.logout`, `param.registered`) sont préservés avec un nouveau style visuel
- Le token CSRF est automatiquement injecté par Thymeleaf via `th:action`
- La page `register.html` originale est conservée comme fallback pour les redirections d'erreur du backend

### Interface utilisateur
L'utilisateur arrive sur une page visuellement impactante : un fond sombre avec l'image Mantu en transparence, un conteneur blanc arrondi avec ombre portée, et un panneau visuel animé à droite. Le passage Login ↔ Register se fait par un glissement fluide du panneau, avec des animations d'entrée séquencées sur chaque élément du formulaire. Sur mobile, l'interface s'adapte en empilant les éléments verticalement avec un panneau visuel compact en haut.

### Valeur ajoutée
Cette refonte améliore significativement la première impression de la plateforme Smart Building. Une interface d'authentification soignée renforce la crédibilité du produit et démontre une attention à l'expérience utilisateur cohérente avec l'ambition IoT/Smart Building du projet. La modularité du CSS (variables, animations réutilisables) facilite les évolutions futures.

#### Emplacement captures
**Figure 9 — Page d'authentification redesignée : vue Login (desktop)**

- Chemin suggéré : `docs/rapport/assets/2026Q1/fig9_auth_redesign_login.png`
- Description : Capture de la nouvelle page de connexion avec le panneau visuel animé à droite et le formulaire de login à gauche.

**Figure 10 — Page d'authentification redesignée : vue Register (desktop)**

- Chemin suggéré : `docs/rapport/assets/2026Q1/fig10_auth_redesign_register.png`
- Description : Capture après le glissement vers le formulaire d'inscription, montrant le panneau visuel à gauche et le formulaire Register à droite.

**Figure 11 — Page d'authentification redesignée : vue mobile**

- Chemin suggéré : `docs/rapport/assets/2026Q1/fig11_auth_redesign_mobile.png`
- Description : Capture de l'interface responsive sur mobile, avec l'empilement vertical du panneau visuel compact et du formulaire.
