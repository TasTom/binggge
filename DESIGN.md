---
name: binggge
description: Carnet de séries clair, simple et sobre.
colors:
  surface: "#f7f8f5"
  paper: "#fff"
  ink: "#252e29"
  muted: "#626b63"
  accent: "#254e40"
  accent-hover: "#193c2f"
  tint: "#eaf0e9"
  line: "#dfe3dc"
  error: "#983f34"
typography:
  display:
    fontFamily: "DM Sans Variable, sans-serif"
    fontSize: "54px"
    fontWeight: 550
    lineHeight: 1.13
    letterSpacing: "-1.9px"
  headline:
    fontFamily: "DM Sans Variable, sans-serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.55px"
  title:
    fontFamily: "DM Sans Variable, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.15px"
  body:
    fontFamily: "DM Sans Variable, sans-serif"
    fontSize: "15px"
    lineHeight: 1.8
  label:
    fontFamily: "DM Sans Variable, sans-serif"
    fontSize: "13px"
    fontWeight: 600
  caption:
    fontFamily: "DM Sans Variable, sans-serif"
    fontSize: "11px"
    lineHeight: 1.6
rounded:
  compact: "6px"
  control: "8px"
  poster: "10px"
  panel: "12px"
spacing:
  compact: "8px"
  control: "12px"
  gap: "16px"
  grid: "20px"
  panel: "24px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-icon:
    rounded: "{rounded.compact}"
    padding: "10px"
  button-text:
    textColor: "{colors.accent}"
    padding: "8px 0"
  search-field:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.panel}"
    padding: "8px 8px 8px 23px"
  suggestion:
    textColor: "{colors.muted}"
    rounded: "{rounded.compact}"
    padding: "6px 11px"
  poster:
    rounded: "{rounded.poster}"
---

# Design System: binggge

## Overview

**Creative North Star: "Un carnet de séries clair"**

Un carnet de séries clair, simple et sobre. Le fond blanc cassé, l’encre verte et les lignes fines cadrent le contenu ; les affiches apportent l’essentiel de la couleur. Les commandes restent usuelles et les confirmations se lisent près de l’action.

Relevé dérivé de front/src/styles.css, App.jsx et main.jsx, avec PRODUCT.md et .impeccable/surface-front.md comme contexte. Aucun navigateur ni capture n’était disponible : cette documentation décrit le code livré, sans validation visuelle.

**Key Characteristics:**

- Palette végétale discrète et surfaces claires.
- DM Sans Variable auto-hébergée, titres courts et métadonnées compactes.
- Grille d’affiches, commandes visibles et états asynchrones explicites.

## Colors

### Primary

Vert forêt : actions, liens et sélection ; sa variante plus sombre accompagne le survol. La teinte claire sert aux confirmations, compteurs et panneaux.

### Neutral

Blanc cassé pour le fond, blanc pour les commandes, encre pour le texte, gris végétal pour les métadonnées et les séparations. Le rouge terre signale l’erreur. Les valeurs normatives sont dans le frontmatter ; les rampes OKLCH du sidecar sont des interpolations d’aperçu, absentes du CSS livré.

**The Accent fonctionnel Rule.** Le vert forêt porte les actions, la navigation courante et les confirmations ; les erreurs emploient leur couleur dédiée.

## Typography

Une seule famille, **DM Sans Variable**, importée localement avec `@fontsource-variable/dm-sans` ; repli sans-serif. Display correspond au titre de page, headline au titre de section, title au titre de série, body à l’introduction, label aux boutons, caption aux métadonnées. Il ne s’agit pas d’une échelle à ratio uniforme.

Sur mobile, le titre de page descend à (40px), puis (35px) au seuil le plus étroit. Les titres de série passent à (16px) entre les seuils tablette et mobile. Les champs de recherche restent à (16px) ; les champs profil et filtre adoptent aussi cette taille sur mobile.

## Layout

Conteneur centré : maximum (1184px), avec largeur disponible moins (96px). À partir de (1600px), maximum (1280px) et retrait de (128px). Aux seuils (1100px), (760px), puis (370px), les retraits deviennent respectivement (64px), (40px), puis (32px). Le corps impose une largeur minimale de (320px).

La grille compte six colonnes, trois à (1100px) et moins, deux à (760px) et moins. Espacement initial issu de `spacing.grid`, puis (16px) horizontal et (28px) vertical sur tablette, (16px) et (26px) sur mobile. Affiches au ratio (210 / 295), images recadrées avec `object-fit: cover`.

Sur mobile, la navigation occupe une seconde ligne, l’aparté introductif disparaît, le panneau profil devient une colonne et le filtre prend toute la largeur. Les espacements sont contextuels, sans grille arithmétique unique.

## Elevation & Depth

La profondeur repose sur les fonds et les bordures fines. Seule la notification flottante a une ombre ; les anneaux de focus servent au repérage des commandes.

**The Surfaces calmes Rule.** Les cartes d’affiches restent sans ombre ; la notification flottante porte l’unique ombre du système.

## Shapes

Angles modérés : commandes, suggestions, affiches et panneaux utilisent les rayons du frontmatter. Bordures habituelles de (1px) ; état vide encadré en pointillés. L’avatar est circulaire, les compteurs et statuts utilisent de petits rayons contextuels (4–5px).

## Components

- **Boutons :** principal plein, texte vert ou commande icône transparente. Hauteur minimale (44px) pour le principal, (48px) pour la recherche, (40px) pour l’icône. Survol, appui et désactivation sont distincts. Focus visible : contour vert de (2px), décalé de (4px).
- **Recherche et champs :** recherche blanche encadrée, icône et action explicites. Le groupe reçoit un anneau au focus ; le champ interne ne le double pas. Le profil conserve un label visible, une bordure d’erreur et un message associé.
- **Navigation et suggestions :** onglet courant vert souligné, compteur à chiffres tabulaires ; suggestions bordées qui se répartissent sur plusieurs lignes.
- **Carte de série :** affiche, titre, année et genre. L’ajout reste visible ; attente avec indicateur tournant et « Ajout… », puis confirmation « Dans ma liste ». En watchlist, un statut remplace cette commande. L’image absente est remplacée par un pictogramme et le titre.
- **États asynchrones :** six squelettes au chargement ; résultat vide, erreur et nouvelle tentative ont leur propre contenu. Les régions utilisent `aria-busy`, `role="status"` ou `role="alert"` selon le contexte. La notification se ferme avec une commande dédiée.
- **Mouvement :** transitions de commandes (160ms), entrée de notification (180ms), pulsation de chargement (1,4s), rotation (1s). `prefers-reduced-motion: reduce` supprime animations et transitions.

## Do's and Don'ts

### Do:

- **Do** conserver les libellés visibles et les états focus, attente, erreur et confirmation.
- **Do** laisser les titres se répartir sur plusieurs lignes et garder le ratio des affiches.
- **Do** respecter le réglage de réduction des animations et la grille responsive existante.

### Don't:

- **Don't** ajouter de décor ou de données inventées à cette interface sobre.
- **Don't** remplacer les pictogrammes SVG par des caractères décoratifs.
- **Don't** masquer l’ajout derrière un survol : la commande reste visible sur l’affiche.

