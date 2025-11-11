export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accessories_catalog: {
        Row: {
          available_in_shop: boolean | null
          category_id: string | null
          couleur: string | null
          created_at: string
          delivery_date: string | null
          description: string | null
          expected_delivery_date: string | null
          fournisseur: string | null
          hauteur_mm: number | null
          id: string
          image_url: string | null
          intensite_amperes: number | null
          largeur_mm: number | null
          last_stock_update: string | null
          longueur_mm: number | null
          marge_nette: number | null
          marge_pourcent: number | null
          marque: string | null
          nom: string
          poids_kg: number | null
          prix_reference: number | null
          prix_vente_ttc: number | null
          promo_active: boolean | null
          promo_end_date: string | null
          promo_price: number | null
          promo_start_date: string | null
          puissance_watts: number | null
          stock_notes: string | null
          stock_quantity: number | null
          stock_status: string | null
          supplier_order_ref: string | null
          tracking_number: string | null
          type_electrique: string | null
          updated_at: string
          url_produit: string | null
          user_id: string
        }
        Insert: {
          available_in_shop?: boolean | null
          category_id?: string | null
          couleur?: string | null
          created_at?: string
          delivery_date?: string | null
          description?: string | null
          expected_delivery_date?: string | null
          fournisseur?: string | null
          hauteur_mm?: number | null
          id?: string
          image_url?: string | null
          intensite_amperes?: number | null
          largeur_mm?: number | null
          last_stock_update?: string | null
          longueur_mm?: number | null
          marge_nette?: number | null
          marge_pourcent?: number | null
          marque?: string | null
          nom: string
          poids_kg?: number | null
          prix_reference?: number | null
          prix_vente_ttc?: number | null
          promo_active?: boolean | null
          promo_end_date?: string | null
          promo_price?: number | null
          promo_start_date?: string | null
          puissance_watts?: number | null
          stock_notes?: string | null
          stock_quantity?: number | null
          stock_status?: string | null
          supplier_order_ref?: string | null
          tracking_number?: string | null
          type_electrique?: string | null
          updated_at?: string
          url_produit?: string | null
          user_id: string
        }
        Update: {
          available_in_shop?: boolean | null
          category_id?: string | null
          couleur?: string | null
          created_at?: string
          delivery_date?: string | null
          description?: string | null
          expected_delivery_date?: string | null
          fournisseur?: string | null
          hauteur_mm?: number | null
          id?: string
          image_url?: string | null
          intensite_amperes?: number | null
          largeur_mm?: number | null
          last_stock_update?: string | null
          longueur_mm?: number | null
          marge_nette?: number | null
          marge_pourcent?: number | null
          marque?: string | null
          nom?: string
          poids_kg?: number | null
          prix_reference?: number | null
          prix_vente_ttc?: number | null
          promo_active?: boolean | null
          promo_end_date?: string | null
          promo_price?: number | null
          promo_start_date?: string | null
          puissance_watts?: number | null
          stock_notes?: string | null
          stock_quantity?: number | null
          stock_status?: string | null
          supplier_order_ref?: string | null
          tracking_number?: string | null
          type_electrique?: string | null
          updated_at?: string
          url_produit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accessories_catalog_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      accessory_options: {
        Row: {
          accessory_id: string
          created_at: string
          id: string
          marge_nette: number | null
          marge_pourcent: number | null
          nom: string
          prix_reference: number | null
          prix_vente_ttc: number | null
        }
        Insert: {
          accessory_id: string
          created_at?: string
          id?: string
          marge_nette?: number | null
          marge_pourcent?: number | null
          nom: string
          prix_reference?: number | null
          prix_vente_ttc?: number | null
        }
        Update: {
          accessory_id?: string
          created_at?: string
          id?: string
          marge_nette?: number | null
          marge_pourcent?: number | null
          nom?: string
          prix_reference?: number | null
          prix_vente_ttc?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accessory_options_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "accessories_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      accessory_tiered_pricing: {
        Row: {
          accessory_id: string
          created_at: string | null
          id: string
          max_quantity: number | null
          min_quantity: number
          prix_unitaire: number
          updated_at: string | null
        }
        Insert: {
          accessory_id: string
          created_at?: string | null
          id?: string
          max_quantity?: number | null
          min_quantity: number
          prix_unitaire: number
          updated_at?: string | null
        }
        Update: {
          accessory_id?: string
          created_at?: string | null
          id?: string
          max_quantity?: number | null
          min_quantity?: number
          prix_unitaire?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accessory_tiered_pricing_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "accessories_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_messages: {
        Row: {
          created_at: string | null
          id: string
          is_global: boolean | null
          is_read: boolean | null
          message: string
          read_at: string | null
          recipient_id: string | null
          sender_id: string | null
          subject: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_global?: boolean | null
          is_read?: boolean | null
          message: string
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string | null
          subject: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_global?: boolean | null
          is_read?: boolean | null
          message?: string
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string | null
          subject?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      administrative_documents: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          project_id: string
          updated_at: string | null
          uploaded_at: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          project_id: string
          updated_at?: string | null
          uploaded_at?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          project_id?: string
          updated_at?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "administrative_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          nom: string
          parent_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nom: string
          parent_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nom?: string
          parent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          postal_code: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      expense_selected_options: {
        Row: {
          created_at: string | null
          expense_id: string
          id: string
          option_id: string
          option_name: string
          prix_vente_ttc: number
        }
        Insert: {
          created_at?: string | null
          expense_id: string
          id?: string
          option_id: string
          option_name: string
          prix_vente_ttc: number
        }
        Update: {
          created_at?: string | null
          expense_id?: string
          id?: string
          option_id?: string
          option_name?: string
          prix_vente_ttc?: number
        }
        Relationships: []
      }
      expenses: {
        Row: {
          categorie: string
          created_at: string | null
          date_depense: string | null
          id: string
          montant: number
          project_id: string | null
        }
        Insert: {
          categorie: string
          created_at?: string | null
          date_depense?: string | null
          id?: string
          montant: number
          project_id?: string | null
        }
        Update: {
          categorie?: string
          created_at?: string | null
          date_depense?: string | null
          id?: string
          montant?: number
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      official_documents: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          file_url: string
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          version: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          file_url: string
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          file_url?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          version?: string | null
        }
        Relationships: []
      }
      project_bank_balance: {
        Row: {
          created_at: string | null
          date_heure_depart: string
          id: string
          project_id: string
          solde_depart: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date_heure_depart?: string
          id?: string
          project_id: string
          solde_depart?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date_heure_depart?: string
          id?: string
          project_id?: string
          solde_depart?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_bank_balance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_expenses: {
        Row: {
          accessory_id: string | null
          amount: number | null
          categorie: string | null
          category: string | null
          created_at: string | null
          date_achat: string | null
          date_paiement: string | null
          delai_paiement: string | null
          description: string | null
          expense_date: string | null
          facture_url: string | null
          fournisseur: string | null
          id: string
          intensite_amperes: number | null
          invoice_number: string | null
          marque: string | null
          nom_accessoire: string | null
          notes: string | null
          payment_status: string | null
          poids_kg: number | null
          prix: number | null
          prix_unitaire: number | null
          prix_vente_ttc: number | null
          project_id: string
          puissance_watts: number | null
          quantite: number | null
          statut_livraison: string | null
          statut_paiement: string | null
          supplier: string | null
          temps_production_heures: number | null
          temps_utilisation_heures: number | null
          type_electrique: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          accessory_id?: string | null
          amount?: number | null
          categorie?: string | null
          category?: string | null
          created_at?: string | null
          date_achat?: string | null
          date_paiement?: string | null
          delai_paiement?: string | null
          description?: string | null
          expense_date?: string | null
          facture_url?: string | null
          fournisseur?: string | null
          id?: string
          intensite_amperes?: number | null
          invoice_number?: string | null
          marque?: string | null
          nom_accessoire?: string | null
          notes?: string | null
          payment_status?: string | null
          poids_kg?: number | null
          prix?: number | null
          prix_unitaire?: number | null
          prix_vente_ttc?: number | null
          project_id: string
          puissance_watts?: number | null
          quantite?: number | null
          statut_livraison?: string | null
          statut_paiement?: string | null
          supplier?: string | null
          temps_production_heures?: number | null
          temps_utilisation_heures?: number | null
          type_electrique?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          accessory_id?: string | null
          amount?: number | null
          categorie?: string | null
          category?: string | null
          created_at?: string | null
          date_achat?: string | null
          date_paiement?: string | null
          delai_paiement?: string | null
          description?: string | null
          expense_date?: string | null
          facture_url?: string | null
          fournisseur?: string | null
          id?: string
          intensite_amperes?: number | null
          invoice_number?: string | null
          marque?: string | null
          nom_accessoire?: string | null
          notes?: string | null
          payment_status?: string | null
          poids_kg?: number | null
          prix?: number | null
          prix_unitaire?: number | null
          prix_vente_ttc?: number | null
          project_id?: string
          puissance_watts?: number | null
          quantite?: number | null
          statut_livraison?: string | null
          statut_paiement?: string | null
          supplier?: string | null
          temps_production_heures?: number | null
          temps_utilisation_heures?: number | null
          type_electrique?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_project_expenses_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_installment_payments: {
        Row: {
          created_at: string | null
          date_debut: string
          id: string
          montant_mensualite: number
          montant_total: number
          nom_paiement: string
          nombre_mensualites_restantes: number
          nombre_mensualites_total: number
          project_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date_debut: string
          id?: string
          montant_mensualite: number
          montant_total: number
          nom_paiement: string
          nombre_mensualites_restantes: number
          nombre_mensualites_total: number
          project_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date_debut?: string
          id?: string
          montant_mensualite?: number
          montant_total?: number
          nom_paiement?: string
          nombre_mensualites_restantes?: number
          nombre_mensualites_total?: number
          project_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_installment_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_payment_transactions: {
        Row: {
          created_at: string | null
          date_paiement: string
          id: string
          mode_paiement: string | null
          montant: number
          notes: string | null
          project_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date_paiement: string
          id?: string
          mode_paiement?: string | null
          montant: number
          notes?: string | null
          project_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date_paiement?: string
          id?: string
          mode_paiement?: string | null
          montant?: number
          notes?: string | null
          project_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_payment_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_todos: {
        Row: {
          completed: boolean | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          project_id: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          project_id: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          project_id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_todos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          adresse_proprietaire: string | null
          budget: number | null
          budget_total: number | null
          carrosserie: string | null
          charge_utile_kg: number | null
          clargeur_mm: number | null
          client_id: string | null
          client_name: string | null
          code_postal_proprietaire: string | null
          commentaires_dreal: string | null
          created_at: string | null
          created_by: string | null
          cylindree: number | null
          date_premiere_circulation: string | null
          date_premiere_immatriculation: string | null
          denomination_commerciale: string | null
          description: string | null
          dimension: string | null
          email_proprietaire: string | null
          end_date: string | null
          energie: string | null
          furniture_data: Json | null
          genre_national: string | null
          hauteur: number | null
          hauteur_mm: number | null
          id: string
          immatriculation: string | null
          largeur: number | null
          largeur_chargement_mm: number | null
          largeur_mm: number | null
          layout_canvas_data: string | null
          longueur: number | null
          longueur_chargement_mm: number | null
          longueur_mm: number | null
          marque: string | null
          marque_officielle: string | null
          marque_vehicule: string | null
          masse_en_charge_max: number | null
          masse_ordre_marche_kg: number | null
          masse_vide: number | null
          modele: string | null
          modele_officiel: string | null
          modele_vehicule: string | null
          name: string | null
          nom: string
          nom_projet: string | null
          nom_proprietaire: string | null
          nombre_places: number | null
          notes_rti: string | null
          numero_chassis: string | null
          numero_chassis_vin: string | null
          photo_url: string | null
          poids_vide_kg: number | null
          prenom_proprietaire: string | null
          ptac_kg: number | null
          ptra: number | null
          puissance_fiscale: number | null
          rti_status: string | null
          rti_submission_date: string | null
          rti_validation_date: string | null
          start_date: string | null
          status: string | null
          statut: string | null
          telephone_proprietaire: string | null
          type_mine: string | null
          user_id: string | null
          vehicle_catalog_id: string | null
          vehicle_catalog_id_v2: string | null
          vehicle_model: string | null
          ville_proprietaire: string | null
          vin: string | null
        }
        Insert: {
          adresse_proprietaire?: string | null
          budget?: number | null
          budget_total?: number | null
          carrosserie?: string | null
          charge_utile_kg?: number | null
          clargeur_mm?: number | null
          client_id?: string | null
          client_name?: string | null
          code_postal_proprietaire?: string | null
          commentaires_dreal?: string | null
          created_at?: string | null
          created_by?: string | null
          cylindree?: number | null
          date_premiere_circulation?: string | null
          date_premiere_immatriculation?: string | null
          denomination_commerciale?: string | null
          description?: string | null
          dimension?: string | null
          email_proprietaire?: string | null
          end_date?: string | null
          energie?: string | null
          furniture_data?: Json | null
          genre_national?: string | null
          hauteur?: number | null
          hauteur_mm?: number | null
          id?: string
          immatriculation?: string | null
          largeur?: number | null
          largeur_chargement_mm?: number | null
          largeur_mm?: number | null
          layout_canvas_data?: string | null
          longueur?: number | null
          longueur_chargement_mm?: number | null
          longueur_mm?: number | null
          marque?: string | null
          marque_officielle?: string | null
          marque_vehicule?: string | null
          masse_en_charge_max?: number | null
          masse_ordre_marche_kg?: number | null
          masse_vide?: number | null
          modele?: string | null
          modele_officiel?: string | null
          modele_vehicule?: string | null
          name?: string | null
          nom: string
          nom_projet?: string | null
          nom_proprietaire?: string | null
          nombre_places?: number | null
          notes_rti?: string | null
          numero_chassis?: string | null
          numero_chassis_vin?: string | null
          photo_url?: string | null
          poids_vide_kg?: number | null
          prenom_proprietaire?: string | null
          ptac_kg?: number | null
          ptra?: number | null
          puissance_fiscale?: number | null
          rti_status?: string | null
          rti_submission_date?: string | null
          rti_validation_date?: string | null
          start_date?: string | null
          status?: string | null
          statut?: string | null
          telephone_proprietaire?: string | null
          type_mine?: string | null
          user_id?: string | null
          vehicle_catalog_id?: string | null
          vehicle_catalog_id_v2?: string | null
          vehicle_model?: string | null
          ville_proprietaire?: string | null
          vin?: string | null
        }
        Update: {
          adresse_proprietaire?: string | null
          budget?: number | null
          budget_total?: number | null
          carrosserie?: string | null
          charge_utile_kg?: number | null
          clargeur_mm?: number | null
          client_id?: string | null
          client_name?: string | null
          code_postal_proprietaire?: string | null
          commentaires_dreal?: string | null
          created_at?: string | null
          created_by?: string | null
          cylindree?: number | null
          date_premiere_circulation?: string | null
          date_premiere_immatriculation?: string | null
          denomination_commerciale?: string | null
          description?: string | null
          dimension?: string | null
          email_proprietaire?: string | null
          end_date?: string | null
          energie?: string | null
          furniture_data?: Json | null
          genre_national?: string | null
          hauteur?: number | null
          hauteur_mm?: number | null
          id?: string
          immatriculation?: string | null
          largeur?: number | null
          largeur_chargement_mm?: number | null
          largeur_mm?: number | null
          layout_canvas_data?: string | null
          longueur?: number | null
          longueur_chargement_mm?: number | null
          longueur_mm?: number | null
          marque?: string | null
          marque_officielle?: string | null
          marque_vehicule?: string | null
          masse_en_charge_max?: number | null
          masse_ordre_marche_kg?: number | null
          masse_vide?: number | null
          modele?: string | null
          modele_officiel?: string | null
          modele_vehicule?: string | null
          name?: string | null
          nom?: string
          nom_projet?: string | null
          nom_proprietaire?: string | null
          nombre_places?: number | null
          notes_rti?: string | null
          numero_chassis?: string | null
          numero_chassis_vin?: string | null
          photo_url?: string | null
          poids_vide_kg?: number | null
          prenom_proprietaire?: string | null
          ptac_kg?: number | null
          ptra?: number | null
          puissance_fiscale?: number | null
          rti_status?: string | null
          rti_submission_date?: string | null
          rti_validation_date?: string | null
          start_date?: string | null
          status?: string | null
          statut?: string | null
          telephone_proprietaire?: string | null
          type_mine?: string | null
          user_id?: string | null
          vehicle_catalog_id?: string | null
          vehicle_catalog_id_v2?: string | null
          vehicle_model?: string | null
          ville_proprietaire?: string | null
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_vehicle_catalog_id_fkey"
            columns: ["vehicle_catalog_id"]
            isOneToOne: false
            referencedRelation: "vehicles_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      rti_submissions: {
        Row: {
          created_at: string | null
          created_by: string | null
          dreal_comments: string | null
          form_data: Json
          id: string
          json_data_url: string | null
          pdf_url: string | null
          project_id: string
          rejection_date: string | null
          status: string | null
          submission_date: string | null
          updated_at: string | null
          validation_date: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          dreal_comments?: string | null
          form_data: Json
          id?: string
          json_data_url?: string | null
          pdf_url?: string | null
          project_id: string
          rejection_date?: string | null
          status?: string | null
          submission_date?: string | null
          updated_at?: string | null
          validation_date?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          dreal_comments?: string | null
          form_data?: Json
          id?: string
          json_data_url?: string | null
          pdf_url?: string | null
          project_id?: string
          rejection_date?: string | null
          status?: string | null
          submission_date?: string | null
          updated_at?: string | null
          validation_date?: string | null
        }
        Relationships: []
      }
      shop_custom_kits: {
        Row: {
          allowed_category_ids: string[] | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          nom: string
          prix_base: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allowed_category_ids?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          nom: string
          prix_base?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allowed_category_ids?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          nom?: string
          prix_base?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      shop_welcome_config: {
        Row: {
          button_text: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          subtitle: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          button_text?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          subtitle?: string | null
          title?: string
          updated_at?: string | null
        }
        Update: {
          button_text?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          subtitle?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      vehicle_registration: {
        Row: {
          carrosserie: string | null
          co2: number | null
          created_at: string | null
          cylindree: number | null
          date_premiere_immatriculation: string | null
          energie: string | null
          genre: string | null
          id: string
          immatriculation: string | null
          marque: string | null
          modele: string | null
          places_assises: number | null
          poids_vide: number | null
          project_id: string | null
          ptac: number | null
          puissance_fiscale: number | null
          type: string | null
          updated_at: string | null
          vin: string | null
        }
        Insert: {
          carrosserie?: string | null
          co2?: number | null
          created_at?: string | null
          cylindree?: number | null
          date_premiere_immatriculation?: string | null
          energie?: string | null
          genre?: string | null
          id?: string
          immatriculation?: string | null
          marque?: string | null
          modele?: string | null
          places_assises?: number | null
          poids_vide?: number | null
          project_id?: string | null
          ptac?: number | null
          puissance_fiscale?: number | null
          type?: string | null
          updated_at?: string | null
          vin?: string | null
        }
        Update: {
          carrosserie?: string | null
          co2?: number | null
          created_at?: string | null
          cylindree?: number | null
          date_premiere_immatriculation?: string | null
          energie?: string | null
          genre?: string | null
          id?: string
          immatriculation?: string | null
          marque?: string | null
          modele?: string | null
          places_assises?: number | null
          poids_vide?: number | null
          project_id?: string | null
          ptac?: number | null
          puissance_fiscale?: number | null
          type?: string | null
          updated_at?: string | null
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_registration_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles_catalog: {
        Row: {
          dimension: string | null
          hauteur_mm: number | null
          id: string
          largeur_mm: number | null
          longueur_mm: number | null
          marque: string
          modele: string
          poids_vide_kg: number | null
          ptac_kg: number | null
        }
        Insert: {
          dimension?: string | null
          hauteur_mm?: number | null
          id?: string
          largeur_mm?: number | null
          longueur_mm?: number | null
          marque: string
          modele: string
          poids_vide_kg?: number | null
          ptac_kg?: number | null
        }
        Update: {
          dimension?: string | null
          hauteur_mm?: number | null
          id?: string
          largeur_mm?: number | null
          longueur_mm?: number | null
          marque?: string
          modele?: string
          poids_vide_kg?: number | null
          ptac_kg?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      count_rti_by_status: {
        Args: never
        Returns: {
          count: number
          status: string
        }[]
      }
      get_latest_rti: {
        Args: { p_project_id: string }
        Returns: {
          created_at: string
          form_data: Json
          id: string
          status: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
