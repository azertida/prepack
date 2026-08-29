# 📦 Prépack

Application web légère pour distinguer deux choses que les gestionnaires de tâches
confondent d'ordinaire : ce qui est **imposé** et ce qui est **souhaité**.

Aucun serveur, aucun compte, aucune donnée qui sort de l'appareil.
Tout est stocké dans le `localStorage` du navigateur.

## Le principe

Une liste de tâches classique fabrique du retard. Chaque échéance qui passe se
transforme en reproche, chaque intention non réalisée s'accumule à côté des vraies
obligations, et le compteur en haut de l'écran ne descend que si l'on travaille.

Prépack sépare donc deux natures :

| | Obligation | Intention |
|---|---|---|
| Origine | Contrainte extérieure | Envie personnelle |
| Date d'échéance | Oui | Aucune |
| Priorité | Oui | Aucune |
| Dépassement signalé | Oui, c'est une information utile | Impossible par construction |
| Affichage | Toutes, triées par date | Échantillon de trois |

Une intention ne peut pas être en retard : elle ne porte aucune temporalité.
Une obligation le peut, et c'est normal — une déclaration fiscale hors délai est un
fait, pas un jugement.

## Ce que l'application ne fait pas

- Pas de compteur de tâches restantes (une dette affichée en permanence)
- Pas de série, de score, de taux de réussite
- Pas de notifications
- Pas de suppression automatique : rien ne disparaît sans décision

Les compteurs affichés sont volontairement des accumulations positives :
*faites cette semaine*, *faites ce mois-ci*. Ils repartent de zéro tout seuls.

## Mises de côté

Une intention qui n'a pas été touchée depuis **huit semaines** rejoint la section
« Mises de côté ». Elle n'est ni supprimée ni cachée : elle est consultable et se
récupère d'un bouton. L'objectif est d'éviter que la liste ne se transforme en
sédiment de vieilles envies.

Le délai se règle dans `app.js` :

```js
const SETASIDE_DAYS = 56;
```

## Fichiers

```
index.html          structure
app.js              logique complète
style.css           thèmes clair et sombre
manifest.json       métadonnées PWA (icône SVG en data-URI)
service-worker.js   cache applicatif, fonctionnement hors ligne
```

Aucune dépendance, aucun outil de build, aucune bibliothèque externe.

## Installation

Déposer les cinq fichiers à la racine d'un dépôt, puis activer GitHub Pages
(Settings → Pages → branche `main`, dossier `/root`).

Tous les chemins sont relatifs (`./`), l'application fonctionne donc depuis un
sous-dossier comme depuis une racine de domaine.

Pour l'utiliser en local, il suffit d'ouvrir `index.html` — le service worker sera
inactif, le reste fonctionnera.

## Mise à jour

Le service worker met tout en cache. **À chaque mise en ligne, incrémenter la
version** dans `service-worker.js`, sinon l'ancienne version continue d'être servie :

```js
const CACHE_NAME = 'prepack-v1';
```

## Données

Le stockage est lié à l'origine du site *et* au contexte. Sur iOS, une PWA installée
sur l'écran d'accueil dispose d'un `localStorage` distinct de celui de l'onglet
Safari : les mêmes données ne sont pas visibles des deux côtés. Il faut choisir un
contexte et s'y tenir.

Le pied de page propose un export et un import au format JSON, qui servent à la fois
de sauvegarde et de passerelle entre deux contextes ou deux appareils.

## Licence

MIT.
