# Instructions pour Claude - Projet Env-Link

## Intégrations API

### Evoliz
- **Authentification** : OAuth avec Bearer Token
- **IMPORTANT** : Avant de coder une fonction en rapport avec Evoliz, vérifie bien la documentation technique fournie
- Le service Evoliz utilise un proxy Supabase Edge Function pour éviter les problèmes CORS
- Voir `src/services/evolizService.ts` pour l'implémentation actuelle

### Gemini (IA)
- **IMPORTANT** : Vérifie la version gratuite actuelle avant toute modification
- La version 1.5 Flash est **obsolète** - ne pas l'utiliser
- Toujours utiliser la version gratuite la plus récente
- Le modèle est configurable via la table `app_settings` dans Supabase
- Modèle par défaut actuel : `gemini-2.0-flash-exp`
- Voir `src/services/aiService.ts` pour l'implémentation

## Conventions de Code

### Versionnement des fichiers
- **Numérote les versions des fichiers dans les commentaires en haut de page**
- Format recommandé :
```typescript
// ============================================
// NOM DU SERVICE/COMPOSANT
// Description brève
// VERSION: X.X - Description des changements
// ============================================
```

### Stack Technique
- **Framework** : React 18 + Vite
- **Langage** : TypeScript
- **UI** : shadcn/ui + Tailwind CSS
- **Backend** : Supabase (auth, database, edge functions)
- **State** : React Query (@tanstack/react-query)
- **Formulaires** : react-hook-form + zod

## Commandes

```bash
npm run dev      # Serveur de développement
npm run build    # Build production
npm run lint     # Linting ESLint
npm run preview  # Preview du build
```

## Structure du Projet

```
src/
├── components/     # Composants React (UI, pages)
├── services/       # Services API (evoliz, ai, etc.)
├── integrations/   # Intégrations tierces (supabase)
├── types/          # Types TypeScript
├── utils/          # Utilitaires
└── hooks/          # Custom hooks React
```

## Bonnes Pratiques

1. Toujours vérifier la documentation API avant d'implémenter des appels externes
2. Utiliser les types TypeScript définis dans `src/types/`
3. Les services API sont des singletons exportés (ex: `evolizApi`, `supabase`)
4. Gérer les erreurs avec des classes d'erreur personnalisées quand nécessaire
