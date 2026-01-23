# Instructions pour Claude (tous les Claude)

Ce fichier contient les instructions à suivre pour tous les agents Claude travaillant sur ce projet.

---

## 📋 Règles de session

### Au début de chaque session
- **Toujours lire `WORK_IN_PROGRESS.md`** pour comprendre le contexte et l'état actuel du projet

### Après chaque tâche terminée
- **Mettre à jour `WORK_IN_PROGRESS.md`** immédiatement (ne pas attendre la fin de la session)
- Y inclure : ce qui a été fait, les décisions prises, les problèmes rencontrés

---

## 📝 Changelog dans les fichiers de code

### Règle des 3 versions
- Garder **uniquement les 3 dernières versions** dans le header du fichier
- Format du changelog en début de fichier :
```typescript
/**
 * NomDuFichier.tsx
 * 
 * Changelog (3 dernières versions) :
 * - v1.2.3 (2025-01-23) : Description courte de la modification
 * - v1.2.2 (2025-01-22) : Description courte
 * - v1.2.1 (2025-01-21) : Description courte
 * 
 * Historique complet : voir WORK_IN_PROGRESS.md
 */
```

### Historique complet
- L'historique complet des modifications va dans `WORK_IN_PROGRESS.md`
- Section dédiée par fichier si nécessaire

---

## 📁 Format des fichiers pour Lovable

Quand tu fournis des fichiers à importer dans Lovable :

1. **Ordre** : Respecter l'ordre des dépendances (fichiers de base en premier)
2. **Format pour chaque fichier** :
   ```
   1. src/chemin/complet/NomDuFichier.tsx
   [lien de téléchargement]
   ```
3. **Résumé** : Ajouter un résumé des modifications avant ou après la liste

---

## 💻 Règles de code

### TypeScript
- Vérifier la syntaxe, pas d'erreurs TypeScript
- Fonctions dans le bon ordre (déclaration avant utilisation)
- Types explicites quand nécessaire

### UI/UX
- **Modales** : flottantes et draggables
- **Inputs** : s'ajustent automatiquement à la longueur du texte
- **Modales** : taille adaptée au contenu (texte non tronqué)

### Commentaires
- Commenter les modifications apportées dans le code
- Garder les commentaires concis et utiles

---

## 🔄 Avant toute modification

1. **Expliquer** les modifications prévues
2. **Demander l'accord** avant d'exécuter
3. Ne jamais modifier sans validation préalable

---

## 🔌 APIs et intégrations

- **Evoliz** : OAuth avec Bearer Token
- **Gemini API** : Pour le traitement de documents et OCR
- **Supabase** : Base de données et authentification

---

## 📍 Contexte projet

- **Projet** : Van Project Buddy
- **Stack** : React/TypeScript + Supabase
- **Plateforme** : Lovable (avec ses contraintes)
- **Métier** : Application SaaS pour la gestion de projets d'aménagement de vans

---

*Dernière mise à jour : 2025-01-23*
