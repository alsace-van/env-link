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
          available_in_shop: boolean
          categorie: string | null
          category_id: string | null
          couleur: string | null
          created_at: string
          delivery_date: string | null
          description: string | null
          fournisseur: string | null
          hauteur_mm: number | null
          id: string
          image_url: string | null
          intensite_amperes: number | null
          largeur_mm: number | null
          longueur_mm: number | null
          marge_pourcent: number | null
          marque: string | null
          nom: string
          notice_id: string | null
          poids_kg: number | null
          prix_reference: number | null
          prix_vente_ttc: number | null
          promo_active: boolean | null
          promo_end_date: string | null
          promo_price: number | null
          promo_start_date: string | null
          puissance_watts: number | null
          stock_quantity: number | null
          stock_status: string | null
          tracking_number: string | null
          type_electrique: string | null
          url_produit: string | null
          user_id: string
        }
        Insert: {
          available_in_shop?: boolean
          categorie?: string | null
          category_id?: string | null
          couleur?: string | null
          created_at?: string
          delivery_date?: string | null
          description?: string | null
          fournisseur?: string | null
          hauteur_mm?: number | null
          id?: string
          image_url?: string | null
          intensite_amperes?: number | null
          largeur_mm?: number | null
          longueur_mm?: number | null
          marge_pourcent?: number | null
          marque?: string | null
          nom: string
          notice_id?: string | null
          poids_kg?: number | null
          prix_reference?: number | null
          prix_vente_ttc?: number | null
          promo_active?: boolean | null
          promo_end_date?: string | null
          promo_price?: number | null
          promo_start_date?: string | null
          puissance_watts?: number | null
          stock_quantity?: number | null
          stock_status?: string | null
          tracking_number?: string | null
          type_electrique?: string | null
          url_produit?: string | null
          user_id: string
        }
        Update: {
          available_in_shop?: boolean
          categorie?: string | null
          category_id?: string | null
          couleur?: string | null
          created_at?: string
          delivery_date?: string | null
          description?: string | null
          fournisseur?: string | null
          hauteur_mm?: number | null
          id?: string
          image_url?: string | null
          intensite_amperes?: number | null
          largeur_mm?: number | null
          longueur_mm?: number | null
          marge_pourcent?: number | null
          marque?: string | null
          nom?: string
          notice_id?: string | null
          poids_kg?: number | null
          prix_reference?: number | null
          prix_vente_ttc?: number | null
          promo_active?: boolean | null
          promo_end_date?: string | null
          promo_price?: number | null
          promo_start_date?: string | null
          puissance_watts?: number | null
          stock_quantity?: number | null
          stock_status?: string | null
          tracking_number?: string | null
          type_electrique?: string | null
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
          {
            foreignKeyName: "accessories_catalog_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "notices_database"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accessories_catalog_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          article_position: number
          created_at: string
          discount_percent: number
          id: string
          updated_at: string
        }
        Insert: {
          accessory_id: string
          article_position: number
          created_at?: string
          discount_percent: number
          id?: string
          updated_at?: string
        }
        Update: {
          accessory_id?: string
          article_position?: number
          created_at?: string
          discount_percent?: number
          id?: string
          updated_at?: string
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
      admin_actions_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_messages: {
        Row: {
          created_at: string
          id: string
          is_global: boolean
          message: string
          read_at: string | null
          recipient_id: string | null
          sender_id: string
          subject: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_global?: boolean
          message: string
          read_at?: string | null
          recipient_id?: string | null
          sender_id: string
          subject: string
        }
        Update: {
          created_at?: string
          id?: string
          is_global?: boolean
          message?: string
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string
          subject?: string
        }
        Relationships: []
      }
      administrative_documents: {
        Row: {
          file_name: string
          file_size: number
          file_url: string
          id: string
          mime_type: string
          project_id: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          file_name: string
          file_size: number
          file_url: string
          id?: string
          mime_type: string
          project_id: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          file_name?: string
          file_size?: number
          file_url?: string
          id?: string
          mime_type?: string
          project_id?: string
          uploaded_at?: string
          user_id?: string
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
      calendar_events: {
        Row: {
          accessory_id: string | null
          all_day: boolean | null
          created_at: string | null
          delivery_date: string | null
          description: string | null
          end_date: string | null
          event_type: string
          id: string
          project_id: string | null
          start_date: string
          title: string
          tracking_number: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          accessory_id?: string | null
          all_day?: boolean | null
          created_at?: string | null
          delivery_date?: string | null
          description?: string | null
          end_date?: string | null
          event_type?: string
          id?: string
          project_id?: string | null
          start_date: string
          title: string
          tracking_number?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          accessory_id?: string | null
          all_day?: boolean | null
          created_at?: string | null
          delivery_date?: string | null
          description?: string | null
          end_date?: string | null
          event_type?: string
          id?: string
          project_id?: string | null
          start_date?: string
          title?: string
          tracking_number?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "accessories_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string
          configuration: Json | null
          created_at: string
          id: string
          price_at_addition: number
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          cart_id: string
          configuration?: Json | null
          created_at?: string
          id?: string
          price_at_addition: number
          product_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          cart_id?: string
          configuration?: Json | null
          created_at?: string
          id?: string
          price_at_addition?: number
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      client_appointments: {
        Row: {
          appointment_date: string
          client_email: string | null
          client_name: string
          client_phone: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          location: string | null
          notes: string | null
          project_id: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          appointment_date: string
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          location?: string | null
          notes?: string | null
          project_id?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          appointment_date?: string
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          location?: string | null
          notes?: string | null
          project_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_appointments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_selected_options: {
        Row: {
          created_at: string
          expense_id: string
          id: string
          option_id: string
        }
        Insert: {
          created_at?: string
          expense_id: string
          id?: string
          option_id: string
        }
        Update: {
          created_at?: string
          expense_id?: string
          id?: string
          option_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_selected_options_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "project_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_selected_options_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "accessory_options"
            referencedColumns: ["id"]
          },
        ]
      }
      notices_database: {
        Row: {
          categorie: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          marque: string | null
          modele: string | null
          titre: string
          url_notice: string
        }
        Insert: {
          categorie?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          marque?: string | null
          modele?: string | null
          titre: string
          url_notice: string
        }
        Update: {
          categorie?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          marque?: string | null
          modele?: string | null
          titre?: string
          url_notice?: string
        }
        Relationships: [
          {
            foreignKeyName: "notices_database_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tiered_pricing: {
        Row: {
          article_position: number
          created_at: string
          discount_percent: number
          id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          article_position: number
          created_at?: string
          discount_percent: number
          id?: string
          product_id: string
          updated_at?: string
        }
        Update: {
          article_position?: number
          created_at?: string
          discount_percent?: number
          id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_tiered_pricing_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          theme_preference: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          theme_preference?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          theme_preference?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_accessories: {
        Row: {
          accessory_id: string
          created_at: string
          id: string
          notes: string | null
          prix_unitaire: number
          project_id: string
          quantite: number
          updated_at: string
        }
        Insert: {
          accessory_id: string
          created_at?: string
          id?: string
          notes?: string | null
          prix_unitaire?: number
          project_id: string
          quantite?: number
          updated_at?: string
        }
        Update: {
          accessory_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          prix_unitaire?: number
          project_id?: string
          quantite?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_accessories_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "accessories_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_accessories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_bank_balance: {
        Row: {
          created_at: string
          date_heure_depart: string
          id: string
          project_id: string
          solde_depart: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_heure_depart?: string
          id?: string
          project_id: string
          solde_depart?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_heure_depart?: string
          id?: string
          project_id?: string
          solde_depart?: number
          updated_at?: string
        }
        Relationships: []
      }
      project_documents: {
        Row: {
          created_at: string
          id: string
          nom_document: string
          project_id: string
          type_document: string | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          nom_document: string
          project_id: string
          type_document?: string | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          nom_document?: string
          project_id?: string
          type_document?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_expenses: {
        Row: {
          accessory_id: string | null
          categorie: string | null
          created_at: string
          date_achat: string | null
          date_paiement: string | null
          delai_paiement: string | null
          facture_url: string | null
          fournisseur: string | null
          hauteur_mm: number | null
          id: string
          intensite_amperes: number | null
          largeur_mm: number | null
          longueur_mm: number | null
          marge_pourcent: number | null
          marque: string | null
          nom_accessoire: string
          notes: string | null
          poids_kg: number | null
          prix: number
          prix_vente_ttc: number | null
          project_id: string | null
          puissance_watts: number | null
          quantite: number
          statut_livraison: string | null
          statut_paiement: string | null
          temps_production_heures: number | null
          temps_utilisation_heures: number | null
          type_electrique: string | null
        }
        Insert: {
          accessory_id?: string | null
          categorie?: string | null
          created_at?: string
          date_achat?: string | null
          date_paiement?: string | null
          delai_paiement?: string | null
          facture_url?: string | null
          fournisseur?: string | null
          hauteur_mm?: number | null
          id?: string
          intensite_amperes?: number | null
          largeur_mm?: number | null
          longueur_mm?: number | null
          marge_pourcent?: number | null
          marque?: string | null
          nom_accessoire: string
          notes?: string | null
          poids_kg?: number | null
          prix: number
          prix_vente_ttc?: number | null
          project_id?: string | null
          puissance_watts?: number | null
          quantite?: number
          statut_livraison?: string | null
          statut_paiement?: string | null
          temps_production_heures?: number | null
          temps_utilisation_heures?: number | null
          type_electrique?: string | null
        }
        Update: {
          accessory_id?: string | null
          categorie?: string | null
          created_at?: string
          date_achat?: string | null
          date_paiement?: string | null
          delai_paiement?: string | null
          facture_url?: string | null
          fournisseur?: string | null
          hauteur_mm?: number | null
          id?: string
          intensite_amperes?: number | null
          largeur_mm?: number | null
          longueur_mm?: number | null
          marge_pourcent?: number | null
          marque?: string | null
          nom_accessoire?: string
          notes?: string | null
          poids_kg?: number | null
          prix?: number
          prix_vente_ttc?: number | null
          project_id?: string | null
          puissance_watts?: number | null
          quantite?: number
          statut_livraison?: string | null
          statut_paiement?: string | null
          temps_production_heures?: number | null
          temps_utilisation_heures?: number | null
          type_electrique?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_expenses_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "accessories_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_installment_payments: {
        Row: {
          created_at: string
          date_debut: string
          id: string
          montant_mensualite: number
          montant_total: number
          nom_paiement: string
          nombre_mensualites_restantes: number
          nombre_mensualites_total: number
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_debut: string
          id?: string
          montant_mensualite?: number
          montant_total?: number
          nom_paiement: string
          nombre_mensualites_restantes?: number
          nombre_mensualites_total?: number
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_debut?: string
          id?: string
          montant_mensualite?: number
          montant_total?: number
          nom_paiement?: string
          nombre_mensualites_restantes?: number
          nombre_mensualites_total?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_monthly_charges: {
        Row: {
          created_at: string
          id: string
          jour_mois: number
          montant: number
          nom_charge: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          jour_mois?: number
          montant?: number
          nom_charge: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          jour_mois?: number
          montant?: number
          nom_charge?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_notes: {
        Row: {
          archived: boolean
          content: string | null
          created_at: string
          id: string
          project_id: string
          title: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          content?: string | null
          created_at?: string
          id?: string
          project_id: string
          title: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          content?: string | null
          created_at?: string
          id?: string
          project_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_payment_transactions: {
        Row: {
          created_at: string
          date_paiement: string
          id: string
          montant: number
          notes: string | null
          project_id: string
          type_paiement: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_paiement: string
          id?: string
          montant?: number
          notes?: string | null
          project_id: string
          type_paiement: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_paiement?: string
          id?: string
          montant?: number
          notes?: string | null
          project_id?: string
          type_paiement?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_payments: {
        Row: {
          acompte: number | null
          acompte_paye: boolean | null
          created_at: string
          id: string
          project_id: string
          solde: number | null
          solde_paye: boolean | null
          updated_at: string
        }
        Insert: {
          acompte?: number | null
          acompte_paye?: boolean | null
          created_at?: string
          id?: string
          project_id: string
          solde?: number | null
          solde_paye?: boolean | null
          updated_at?: string
        }
        Update: {
          acompte?: number | null
          acompte_paye?: boolean | null
          created_at?: string
          id?: string
          project_id?: string
          solde?: number | null
          solde_paye?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_photos: {
        Row: {
          annotations: Json | null
          comment: string | null
          created_at: string
          description: string | null
          id: string
          project_id: string
          type: string
          url: string
        }
        Insert: {
          annotations?: Json | null
          comment?: string | null
          created_at?: string
          description?: string | null
          id?: string
          project_id: string
          type: string
          url: string
        }
        Update: {
          annotations?: Json | null
          comment?: string | null
          created_at?: string
          description?: string | null
          id?: string
          project_id?: string
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_todos: {
        Row: {
          completed: boolean
          created_at: string
          due_date: string | null
          id: string
          priority: string | null
          project_id: string
          title: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          due_date?: string | null
          id?: string
          priority?: string | null
          project_id: string
          title: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          due_date?: string | null
          id?: string
          priority?: string | null
          project_id?: string
          title?: string
          updated_at?: string
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
          charge_utile_kg: number | null
          created_at: string
          date_debut: string | null
          date_fin: string | null
          date_mise_circulation: string | null
          email_proprietaire: string | null
          furniture_data: Json | null
          hauteur_mm: number | null
          id: string
          immatriculation: string | null
          largeur_chargement_mm: number | null
          largeur_mm: number | null
          layout_canvas_data: Json | null
          longueur_chargement_mm: number | null
          longueur_mm: number | null
          marque_custom: string | null
          modele_custom: string | null
          nom_projet: string | null
          nom_proprietaire: string
          numero_chassis: string | null
          photo_url: string | null
          poids_vide_kg: number | null
          ptac_kg: number | null
          statut: string | null
          technical_canvas_data: string | null
          technical_canvas_data_2: string | null
          telephone_proprietaire: string | null
          type_mine: string | null
          updated_at: string
          user_id: string
          vehicle_catalog_id: string | null
        }
        Insert: {
          adresse_proprietaire?: string | null
          budget?: number | null
          charge_utile_kg?: number | null
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          date_mise_circulation?: string | null
          email_proprietaire?: string | null
          furniture_data?: Json | null
          hauteur_mm?: number | null
          id?: string
          immatriculation?: string | null
          largeur_chargement_mm?: number | null
          largeur_mm?: number | null
          layout_canvas_data?: Json | null
          longueur_chargement_mm?: number | null
          longueur_mm?: number | null
          marque_custom?: string | null
          modele_custom?: string | null
          nom_projet?: string | null
          nom_proprietaire: string
          numero_chassis?: string | null
          photo_url?: string | null
          poids_vide_kg?: number | null
          ptac_kg?: number | null
          statut?: string | null
          technical_canvas_data?: string | null
          technical_canvas_data_2?: string | null
          telephone_proprietaire?: string | null
          type_mine?: string | null
          updated_at?: string
          user_id: string
          vehicle_catalog_id?: string | null
        }
        Update: {
          adresse_proprietaire?: string | null
          budget?: number | null
          charge_utile_kg?: number | null
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          date_mise_circulation?: string | null
          email_proprietaire?: string | null
          furniture_data?: Json | null
          hauteur_mm?: number | null
          id?: string
          immatriculation?: string | null
          largeur_chargement_mm?: number | null
          largeur_mm?: number | null
          layout_canvas_data?: Json | null
          longueur_chargement_mm?: number | null
          longueur_mm?: number | null
          marque_custom?: string | null
          modele_custom?: string | null
          nom_projet?: string | null
          nom_proprietaire?: string
          numero_chassis?: string | null
          photo_url?: string | null
          poids_vide_kg?: number | null
          ptac_kg?: number | null
          statut?: string | null
          technical_canvas_data?: string | null
          technical_canvas_data_2?: string | null
          telephone_proprietaire?: string | null
          type_mine?: string | null
          updated_at?: string
          user_id?: string
          vehicle_catalog_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      shop_custom_kits: {
        Row: {
          allowed_category_ids: string[] | null
          created_at: string
          id: string
          product_id: string
        }
        Insert: {
          allowed_category_ids?: string[] | null
          created_at?: string
          id?: string
          product_id: string
        }
        Update: {
          allowed_category_ids?: string[] | null
          created_at?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_custom_kits_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_customers: {
        Row: {
          billing_address: string
          billing_city: string
          billing_country: string
          billing_postal_code: string
          company_name: string | null
          created_at: string | null
          email: string
          first_name: string
          has_project_subscription: boolean | null
          id: string
          last_name: string
          phone: string
          shipping_address: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_postal_code: string | null
          shipping_recipient_name: string | null
          shipping_same_as_billing: boolean | null
          updated_at: string | null
          user_id: string | null
          vat_number: string | null
        }
        Insert: {
          billing_address: string
          billing_city: string
          billing_country?: string
          billing_postal_code: string
          company_name?: string | null
          created_at?: string | null
          email: string
          first_name: string
          has_project_subscription?: boolean | null
          id?: string
          last_name: string
          phone: string
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_postal_code?: string | null
          shipping_recipient_name?: string | null
          shipping_same_as_billing?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          vat_number?: string | null
        }
        Update: {
          billing_address?: string
          billing_city?: string
          billing_country?: string
          billing_postal_code?: string
          company_name?: string | null
          created_at?: string | null
          email?: string
          first_name?: string
          has_project_subscription?: boolean | null
          id?: string
          last_name?: string
          phone?: string
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_postal_code?: string | null
          shipping_recipient_name?: string | null
          shipping_same_as_billing?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          vat_number?: string | null
        }
        Relationships: []
      }
      shop_order_items: {
        Row: {
          configuration: Json | null
          created_at: string | null
          id: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          configuration?: Json | null
          created_at?: string | null
          id?: string
          order_id: string
          product_id: string
          product_name: string
          quantity?: number
          unit_price: number
        }
        Update: {
          configuration?: Json | null
          created_at?: string | null
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shop_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_orders: {
        Row: {
          added_to_expenses: boolean | null
          created_at: string | null
          customer_id: string | null
          expense_type: string | null
          id: string
          notes: string | null
          order_number: string
          status: string | null
          total_amount: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          added_to_expenses?: boolean | null
          created_at?: string | null
          customer_id?: string | null
          expense_type?: string | null
          id?: string
          notes?: string | null
          order_number: string
          status?: string | null
          total_amount?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          added_to_expenses?: boolean | null
          created_at?: string | null
          customer_id?: string | null
          expense_type?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          status?: string | null
          total_amount?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "shop_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_product_items: {
        Row: {
          accessory_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
        }
        Insert: {
          accessory_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
        }
        Update: {
          accessory_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_product_items_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "accessories_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_product_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price: number
          promo_active: boolean | null
          promo_end_date: string | null
          promo_price: number | null
          promo_start_date: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price?: number
          promo_active?: boolean | null
          promo_end_date?: string | null
          promo_price?: number | null
          promo_start_date?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price?: number
          promo_active?: boolean | null
          promo_end_date?: string | null
          promo_price?: number | null
          promo_start_date?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shop_welcome_config: {
        Row: {
          button_text: string
          created_at: string
          description: string
          id: string
          image_url: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          button_text?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          button_text?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      supplier_expenses: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          order_date: string | null
          product_name: string
          quantity: number
          supplier_id: string | null
          total_amount: number
          unit_price: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          product_name: string
          quantity?: number
          supplier_id?: string | null
          total_amount: number
          unit_price: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          product_name?: string
          quantity?: number
          supplier_id?: string | null
          total_amount?: number
          unit_price?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      technical_schemas: {
        Row: {
          canvas_data: string | null
          created_at: string
          id: string
          project_id: string
          schema_number: number
          updated_at: string
        }
        Insert: {
          canvas_data?: string | null
          created_at?: string
          id?: string
          project_id: string
          schema_number: number
          updated_at?: string
        }
        Update: {
          canvas_data?: string | null
          created_at?: string
          id?: string
          project_id?: string
          schema_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_schemas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_logins: {
        Row: {
          id: string
          ip_address: string | null
          login_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          ip_address?: string | null
          login_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          id?: string
          ip_address?: string | null
          login_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles_catalog: {
        Row: {
          charge_utile_kg: number | null
          created_at: string
          hauteur_mm: number | null
          id: string
          largeur_mm: number | null
          longueur_mm: number
          marque: string
          modele: string
          poids_vide_kg: number | null
          ptac_kg: number | null
        }
        Insert: {
          charge_utile_kg?: number | null
          created_at?: string
          hauteur_mm?: number | null
          id?: string
          largeur_mm?: number | null
          longueur_mm: number
          marque: string
          modele: string
          poids_vide_kg?: number | null
          ptac_kg?: number | null
        }
        Update: {
          charge_utile_kg?: number | null
          created_at?: string
          hauteur_mm?: number | null
          id?: string
          largeur_mm?: number | null
          longueur_mm?: number
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
      calculate_accessory_tiered_price: {
        Args: {
          p_accessory_id: string
          p_base_price: number
          p_quantity: number
        }
        Returns: number
      }
      calculate_tiered_price: {
        Args: { p_base_price: number; p_product_id: string; p_quantity: number }
        Returns: number
      }
      generate_order_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
