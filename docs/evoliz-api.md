# Documentation API Evoliz

Cette documentation est au format OpenAPI 3.0. Référence officielle pour toutes les intégrations Evoliz.

## Informations clés

- **Base URL** : `https://www.evoliz.io/`
- **Version API** : v1
- **Authentification** : OAuth Bearer Token (20 min de validité)

## Authentification

### Étape 1 : Login
```
POST /api/login
Content-Type: application/json

{
  "public_key": "YOUR_PUBLIC_KEY",
  "secret_key": "YOUR_SECRET_KEY"
}
```

### Réponse
```json
{
  "access_token": "1234...",
  "expires_at": "2019-10-10T09:26:40.000000Z",
  "scopes": ["admin", "company_users"]
}
```

### Étape 2 : Utiliser le token
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## Rate Limiting
- Limite globale : 100 requêtes/minute
- Headers de réponse : `x-ratelimit-limit`, `x-ratelimit-remaining`

## Pagination
- Paramètre : `?page=X&per_page=Y` (1-100)
- Par défaut : 15 résultats par page

## Codes d'erreur

| Code | Description |
|------|-------------|
| 400 | Bad Request - Syntaxe incorrecte |
| 401 | Unauthorized - Clé API invalide |
| 403 | Forbidden - Pas de permission |
| 404 | Not Found - Ressource inexistante |
| 422 | Unprocessable Entity - Données invalides |
| 429 | Too Many Requests - Rate limit dépassé |
| 500 | Server Error |

## Périodes disponibles

| Nom | Description |
|-----|-------------|
| `lastmonth` | Mois dernier |
| `currentmonth` | Mois en cours |
| `last3months` | 3 derniers mois |
| `last6months` | 6 derniers mois |
| `currentyear` | Année en cours |
| `lastyear` | Année dernière |
| `fiscalyear` | Exercice fiscal |
| `custom` | Période personnalisée (avec `date_min` et `date_max`) |

---

## Spécification OpenAPI complète

```yaml
openapi: 3.0.0
info:
  title: 'Api Evoliz '
  description: |
    Evoliz Application Program Interface

    # Introduction

    This API is documented in **OpenAPI format**.
    In addition to standard OpenAPI syntax we use a few
    [vendor extensions](https://github.com/Redocly/redoc/blob/master/docs/redoc-vendor-extensions.md).
    The Evoliz API is built on HTTP. Our **API is RESTful**. It has predictable
    resource URLs. It returns **HTTP response codes to indicate errors**.
    It also accepts and returns JSON in the HTTP body.

    You can use your favorite HTTP/REST library for your programming language to
    use Evoliz API.

    # Authentication


    ## Getting started

    To use our API, please generate your API keys within the application by following these steps:

    1. Log in to your existing account.
    2. Navigate to the "Applications" section.
    3. In the "Available Connectors" section, enable the Evoliz API connector.
    4. Generate a set of API credentials by clicking the "Create API Key" button. This will provide you with your public and secret API keys.
    5. Securely store your secret key to ensure that only your servers can make authenticated API calls.

    ## API login

    You authenticate to the Evoliz API by sending your **public & secret key**
    to the [/api/login](#tag/Login) endpoint in a `POST` request.

    The endpoint will return an `access_token` that has to be given in the
    **request header** of any other API endpoint in this form :
    `Authorization: Bearer YOUR_ACCESS_TOKEN`.

    The token has a 20 minutes validity specified in `expires_at` attribute of
    the endpoint response.

  contact:
    email: support+api@evoliz.com
  version: '1.39'
servers:
  - url: https://www.evoliz.io/
```

## Endpoints principaux

### Clients
- `GET /api/v1/companies/{companyid}/clients` - Liste des clients
- `POST /api/v1/companies/{companyid}/clients` - Créer un client
- `GET /api/v1/companies/{companyid}/clients/{clientid}` - Détail client
- `PATCH /api/v1/companies/{companyid}/clients/{clientid}` - Modifier client

### Devis (Quotes)
- `GET /api/v1/companies/{companyid}/quotes` - Liste des devis
- `POST /api/v1/companies/{companyid}/quotes` - Créer un devis
- `GET /api/v1/companies/{companyid}/quotes/{quoteid}` - Détail devis
- `PUT /api/v1/companies/{companyid}/quotes/{quoteid}` - Modifier devis
- `POST /api/v1/companies/{companyid}/quotes/{quoteid}/invoice` - Facturer un devis
- `POST /api/v1/companies/{companyid}/quotes/{quoteid}/send` - Envoyer par email

### Factures (Invoices)
- `GET /api/v1/companies/{companyid}/invoices` - Liste des factures
- `POST /api/v1/companies/{companyid}/invoices` - Créer une facture (brouillon)
- `GET /api/v1/companies/{companyid}/invoices/{invoiceid}` - Détail facture
- `PUT /api/v1/companies/{companyid}/invoices/{invoiceid}` - Modifier facture
- `POST /api/v1/companies/{companyid}/invoices/{invoiceid}/create` - Valider facture
- `POST /api/v1/companies/{companyid}/invoices/{invoiceid}/send` - Envoyer par email
- `POST /api/v1/companies/{companyid}/invoices/{invoiceid}/payments` - Ajouter paiement

### Avoirs (Credits)
- `GET /api/v1/companies/{companyid}/credits` - Liste des avoirs
- `POST /api/v1/companies/{companyid}/credits` - Créer un avoir
- `POST /api/v1/companies/{companyid}/invoices/{invoiceid}/credit` - Avoir total depuis facture

### Achats (Buys)
- `GET /api/v1/companies/{companyid}/buys` - Liste des achats
- `POST /api/v1/companies/{companyid}/buys` - Créer un achat
- `GET /api/v1/companies/{companyid}/buys/{buyid}` - Détail achat

### Fournisseurs (Suppliers)
- `GET /api/v1/companies/{companyid}/suppliers` - Liste fournisseurs
- `POST /api/v1/companies/{companyid}/suppliers` - Créer fournisseur
- `GET /api/v1/companies/{companyid}/suppliers/{supplierid}` - Détail fournisseur

### Articles
- `GET /api/v1/companies/{companyid}/articles` - Liste articles
- `POST /api/v1/companies/{companyid}/articles` - Créer article
- `GET /api/v1/companies/{companyid}/articles/{articleid}` - Détail article
- `PATCH /api/v1/companies/{companyid}/articles/{articleid}` - Modifier article

### Paiements
- `GET /api/v1/companies/{companyid}/payments` - Liste paiements
- `GET /api/v1/companies/{companyid}/payments/{paymentid}` - Détail paiement
- `DELETE /api/v1/companies/{companyid}/payments/{paymentid}` - Supprimer paiement

### Classifications
- `GET /api/v1/companies/{companyid}/sale-classifications` - Classifications vente
- `GET /api/v1/companies/{companyid}/purchase-classifications` - Classifications achat
- `GET /api/v1/companies/{companyid}/payterms` - Conditions de paiement
- `GET /api/v1/companies/{companyid}/paytypes` - Types de paiement

## Statuts des documents

### Factures (Invoices)
| Code | Status | Description |
|------|--------|-------------|
| 1 | filled | Brouillon, modifiable |
| 2 | create | Validée, numéro définitif |
| 4 | sent | Envoyée au client |
| 8 | inpayment | Partiellement payée |
| 16 | paid | Entièrement payée |
| 22 | match | Rapprochée bancaire |

### Devis (Quotes)
| Code | Status | Description |
|------|--------|-------------|
| 1 | filled | Brouillon |
| 2 | create | Validé |
| 4 | sent | Envoyé |
| 8 | accept | Accepté |
| -1 | reject | Refusé |
| 20 | invoice | Facturé |
| 24 | close | Clôturé |

### Achats (Buys)
| Code | Status | Description |
|------|--------|-------------|
| 2 | create | Enregistré |
| 4 | prepare | Vérifié |
| 6 | voucher | Validé, en attente paiement |
| 8 | inpayment | Partiellement payé |
| 16 | paid | Entièrement payé |
| 22 | match | Rapproché bancaire |

## Schémas de données principaux

### Client
```json
{
  "clientid": 9876,
  "code": "C00123",
  "name": "Triiptic",
  "type": "Professionnel",
  "address": {
    "addr": "176 avenue Joseph Louis Lambot",
    "postcode": "83130",
    "town": "La Garde",
    "country": { "label": "France", "iso2": "FR" }
  },
  "phone": "01 46 72 50 04",
  "email": "contact@triiptic.fr",
  "vat_number": "FR20123456789",
  "business_number": "123 456 789 12345"
}
```

### Item de document (facture/devis)
```json
{
  "type": "article",
  "articleid": 12345,
  "reference": "SPLIT",
  "designation": "Banana Split",
  "quantity": 12,
  "unit": "U",
  "unit_price": 28.25,
  "vat_rate": 20.00,
  "rebate": "5.25%"
}
```

### Achat (Buy)
```json
{
  "supplierid": 9876,
  "documentdate": "2022-03-30",
  "label": "Abonnement Logiciel",
  "total_vat_include": 80.75,
  "external_document_number": "EXT0001",
  "items": [
    {
      "classificationid": 705,
      "total_vat_exclude": 67.29
    }
  ]
}
```

## Notes importantes

1. **Le paramètre `companyid`** est optionnel si l'utilisateur est connecté à une seule entreprise
2. **Les montants** sont toujours en euros sauf indication contraire
3. **Les dates** sont au format `YYYY-MM-DD`
4. **Les timestamps** sont au format ISO 8601 : `2019-10-10T09:26:39.000000Z`
5. **Pour créer une facture** : d'abord POST (brouillon), puis POST `/create` (validation)
