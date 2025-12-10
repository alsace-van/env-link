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
          capacite_ah: number | null
          category_id: string | null
          couleur: string | null
          created_at: string
          delivery_date: string | null
          description: string | null
          description_media: Json | null
          evoliz_article_id: number | null
          expected_delivery_date: string | null
          fournisseur: string | null
          hauteur_mm: number | null
          homologation_number: string | null
          id: string
          image_url: string | null
          imported_at: string | null
          intensite_amperes: number | null
          largeur_mm: number | null
          last_price_check: string | null
          last_stock_update: string | null
          longueur_mm: number | null
          marge_nette: number | null
          marge_pourcent: number | null
          marque: string | null
          needs_completion: boolean | null
          nom: string
          poids_kg: number | null
          prix_achat_updated_at: string | null
          prix_public_ttc: number | null
          prix_public_updated_at: string | null
          prix_reference: number | null
          prix_vente_ttc: number | null
          product_group_id: string | null
          promo_active: boolean | null
          promo_end_date: string | null
          promo_price: number | null
          promo_start_date: string | null
          puissance_watts: number | null
          pv_r14: string | null
          pv_r16: string | null
          pv_r17: string | null
          reference_fabricant: string | null
          reference_interne: string | null
          stock_notes: string | null
          stock_quantity: number | null
          stock_status: string | null
          supplier_id: string | null
          supplier_order_ref: string | null
          supplier_reference: string | null
          technical_ref: string | null
          tension_volts: number | null
          tracking_number: string | null
          type_electrique: string | null
          updated_at: string
          url_produit: string | null
          user_id: string
          volume_litres: number | null
        }
        Insert: {
          available_in_shop?: boolean | null
          capacite_ah?: number | null
          category_id?: string | null
          couleur?: string | null
          created_at?: string
          delivery_date?: string | null
          description?: string | null
          description_media?: Json | null
          evoliz_article_id?: number | null
          expected_delivery_date?: string | null
          fournisseur?: string | null
          hauteur_mm?: number | null
          homologation_number?: string | null
          id?: string
          image_url?: string | null
          imported_at?: string | null
          intensite_amperes?: number | null
          largeur_mm?: number | null
          last_price_check?: string | null
          last_stock_update?: string | null
          longueur_mm?: number | null
          marge_nette?: number | null
          marge_pourcent?: number | null
          marque?: string | null
          needs_completion?: boolean | null
          nom: string
          poids_kg?: number | null
          prix_achat_updated_at?: string | null
          prix_public_ttc?: number | null
          prix_public_updated_at?: string | null
          prix_reference?: number | null
          prix_vente_ttc?: number | null
          product_group_id?: string | null
          promo_active?: boolean | null
          promo_end_date?: string | null
          promo_price?: number | null
          promo_start_date?: string | null
          puissance_watts?: number | null
          pv_r14?: string | null
          pv_r16?: string | null
          pv_r17?: string | null
          reference_fabricant?: string | null
          reference_interne?: string | null
          stock_notes?: string | null
          stock_quantity?: number | null
          stock_status?: string | null
          supplier_id?: string | null
          supplier_order_ref?: string | null
          supplier_reference?: string | null
          technical_ref?: string | null
          tension_volts?: number | null
          tracking_number?: string | null
          type_electrique?: string | null
          updated_at?: string
          url_produit?: string | null
          user_id: string
          volume_litres?: number | null
        }
        Update: {
          available_in_shop?: boolean | null
          capacite_ah?: number | null
          category_id?: string | null
          couleur?: string | null
          created_at?: string
          delivery_date?: string | null
          description?: string | null
          description_media?: Json | null
          evoliz_article_id?: number | null
          expected_delivery_date?: string | null
          fournisseur?: string | null
          hauteur_mm?: number | null
          homologation_number?: string | null
          id?: string
          image_url?: string | null
          imported_at?: string | null
          intensite_amperes?: number | null
          largeur_mm?: number | null
          last_price_check?: string | null
          last_stock_update?: string | null
          longueur_mm?: number | null
          marge_nette?: number | null
          marge_pourcent?: number | null
          marque?: string | null
          needs_completion?: boolean | null
          nom?: string
          poids_kg?: number | null
          prix_achat_updated_at?: string | null
          prix_public_ttc?: number | null
          prix_public_updated_at?: string | null
          prix_reference?: number | null
          prix_vente_ttc?: number | null
          product_group_id?: string | null
          promo_active?: boolean | null
          promo_end_date?: string | null
          promo_price?: number | null
          promo_start_date?: string | null
          puissance_watts?: number | null
          pv_r14?: string | null
          pv_r16?: string | null
          pv_r17?: string | null
          reference_fabricant?: string | null
          reference_interne?: string | null
          stock_notes?: string | null
          stock_quantity?: number | null
          stock_status?: string | null
          supplier_id?: string | null
          supplier_order_ref?: string | null
          supplier_reference?: string | null
          technical_ref?: string | null
          tension_volts?: number | null
          tracking_number?: string | null
          type_electrique?: string | null
          updated_at?: string
          url_produit?: string | null
          user_id?: string
          volume_litres?: number | null
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
            foreignKeyName: "accessories_catalog_product_group_id_fkey"
            columns: ["product_group_id"]
            isOneToOne: false
            referencedRelation: "product_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accessories_catalog_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "user_suppliers"
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
      accessory_shipping_fees: {
        Row: {
          accessory_id: string
          created_at: string | null
          id: string
          shipping_fee_id: string
          updated_at: string | null
          visible_boutique: boolean | null
          visible_depenses: boolean | null
        }
        Insert: {
          accessory_id: string
          created_at?: string | null
          id?: string
          shipping_fee_id: string
          updated_at?: string | null
          visible_boutique?: boolean | null
          visible_depenses?: boolean | null
        }
        Update: {
          accessory_id?: string
          created_at?: string | null
          id?: string
          shipping_fee_id?: string
          updated_at?: string | null
          visible_boutique?: boolean | null
          visible_depenses?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "accessory_shipping_fees_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "accessories_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accessory_shipping_fees_shipping_fee_id_fkey"
            columns: ["shipping_fee_id"]
            isOneToOne: false
            referencedRelation: "shipping_fees"
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
      admin_actions_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string | null
          details: Json | null
          id: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
        }
        Relationships: []
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
      app_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string
        }
        Relationships: []
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
          icon: string | null
          id: string
          nom: string
          parent_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          nom: string
          parent_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string | null
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
          appointment_time: string
          client_name: string
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          project_id: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          client_name: string
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          project_id: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          client_name?: string
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          project_id?: string
          status?: string | null
          updated_at?: string | null
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
      devis_snapshots: {
        Row: {
          contenu_complet: Json
          created_at: string | null
          date_snapshot: string | null
          id: string
          nom_snapshot: string
          notes: string | null
          project_id: string
          scenario_id: string | null
          version_numero: number
        }
        Insert: {
          contenu_complet: Json
          created_at?: string | null
          date_snapshot?: string | null
          id?: string
          nom_snapshot: string
          notes?: string | null
          project_id: string
          scenario_id?: string | null
          version_numero: number
        }
        Update: {
          contenu_complet?: Json
          created_at?: string | null
          date_snapshot?: string | null
          id?: string
          nom_snapshot?: string
          notes?: string | null
          project_id?: string
          scenario_id?: string | null
          version_numero?: number
        }
        Relationships: [
          {
            foreignKeyName: "devis_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_snapshots_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "project_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          metadata: Json | null
          page_number: number | null
          source_id: string
          source_name: string | null
          source_type: string
          user_id: string | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          page_number?: number | null
          source_id: string
          source_name?: string | null
          source_type: string
          user_id?: string | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          page_number?: number | null
          source_id?: string
          source_name?: string | null
          source_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      downloads: {
        Row: {
          category: string
          changelog: string | null
          created_at: string | null
          description: string | null
          documentation_url: string | null
          download_count: number | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          icon_url: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          name: string
          platform: string | null
          requirements: string | null
          sort_order: number | null
          updated_at: string | null
          version: string | null
        }
        Insert: {
          category?: string
          changelog?: string | null
          created_at?: string | null
          description?: string | null
          documentation_url?: string | null
          download_count?: number | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name: string
          platform?: string | null
          requirements?: string | null
          sort_order?: number | null
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          category?: string
          changelog?: string | null
          created_at?: string | null
          description?: string | null
          documentation_url?: string | null
          download_count?: number | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name?: string
          platform?: string | null
          requirements?: string | null
          sort_order?: number | null
          updated_at?: string | null
          version?: string | null
        }
        Relationships: []
      }
      evoliz_clients_mapping: {
        Row: {
          created_at: string | null
          evoliz_client_email: string | null
          evoliz_client_id: number
          evoliz_client_name: string | null
          id: string
          last_synced_at: string | null
          sync_direction: string | null
          updated_at: string | null
          user_id: string
          vpb_client_id: string | null
        }
        Insert: {
          created_at?: string | null
          evoliz_client_email?: string | null
          evoliz_client_id: number
          evoliz_client_name?: string | null
          id?: string
          last_synced_at?: string | null
          sync_direction?: string | null
          updated_at?: string | null
          user_id: string
          vpb_client_id?: string | null
        }
        Update: {
          created_at?: string | null
          evoliz_client_email?: string | null
          evoliz_client_id?: number
          evoliz_client_name?: string | null
          id?: string
          last_synced_at?: string | null
          sync_direction?: string | null
          updated_at?: string | null
          user_id?: string
          vpb_client_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evoliz_clients_mapping_vpb_client_id_fkey"
            columns: ["vpb_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      evoliz_credentials: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          last_test_at: string | null
          last_test_success: boolean | null
          public_key: string
          secret_key: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_test_at?: string | null
          last_test_success?: boolean | null
          public_key: string
          secret_key: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_test_at?: string | null
          last_test_success?: boolean | null
          public_key?: string
          secret_key?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      evoliz_imports: {
        Row: {
          created_at: string | null
          evoliz_document_number: string | null
          evoliz_quote_id: string
          id: string
          import_date: string | null
          lignes_importees: number | null
          project_id: string | null
          total_materiel_ht: number | null
          total_mo_ht: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          evoliz_document_number?: string | null
          evoliz_quote_id: string
          id?: string
          import_date?: string | null
          lignes_importees?: number | null
          project_id?: string | null
          total_materiel_ht?: number | null
          total_mo_ht?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          evoliz_document_number?: string | null
          evoliz_quote_id?: string
          id?: string
          import_date?: string | null
          lignes_importees?: number | null
          project_id?: string | null
          total_materiel_ht?: number | null
          total_mo_ht?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evoliz_imports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      evoliz_quotes_cache: {
        Row: {
          client_id: string | null
          created_at: string | null
          currency: string | null
          evoliz_client_id: number | null
          evoliz_quote_id: number
          id: string
          issue_date: string | null
          project_id: string | null
          quote_number: string | null
          raw_data: Json | null
          status: string | null
          synced_at: string | null
          title: string | null
          total_ht: number | null
          total_ttc: number | null
          updated_at: string | null
          user_id: string
          validity_date: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          currency?: string | null
          evoliz_client_id?: number | null
          evoliz_quote_id: number
          id?: string
          issue_date?: string | null
          project_id?: string | null
          quote_number?: string | null
          raw_data?: Json | null
          status?: string | null
          synced_at?: string | null
          title?: string | null
          total_ht?: number | null
          total_ttc?: number | null
          updated_at?: string | null
          user_id: string
          validity_date?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          currency?: string | null
          evoliz_client_id?: number | null
          evoliz_quote_id?: number
          id?: string
          issue_date?: string | null
          project_id?: string | null
          quote_number?: string | null
          raw_data?: Json | null
          status?: string | null
          synced_at?: string | null
          title?: string | null
          total_ht?: number | null
          total_ttc?: number | null
          updated_at?: string | null
          user_id?: string
          validity_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evoliz_quotes_cache_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evoliz_quotes_cache_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      external_transformers: {
        Row: {
          address: string | null
          city: string | null
          company_name: string
          contact_name: string | null
          contact_title: string | null
          created_at: string | null
          email: string | null
          id: string
          phone: string | null
          postal_code: string | null
          project_id: string
          siret: string | null
          updated_at: string | null
          work_description: string | null
          work_type: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_name: string
          contact_name?: string | null
          contact_title?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          postal_code?: string | null
          project_id: string
          siret?: string | null
          updated_at?: string | null
          work_description?: string | null
          work_type?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_name?: string
          contact_name?: string | null
          contact_title?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          postal_code?: string | null
          project_id?: string
          siret?: string | null
          updated_at?: string | null
          work_description?: string | null
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_transformers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      incoming_invoices: {
        Row: {
          confidence: number | null
          created_at: string | null
          description: string | null
          detected_zones: Json | null
          due_date: string | null
          evoliz_error: string | null
          evoliz_expense_id: string | null
          evoliz_sent_at: string | null
          evoliz_status: string | null
          file_name: string
          file_path: string
          file_url: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          mime_type: string | null
          ocr_error: string | null
          ocr_result: Json | null
          source: string | null
          status: string | null
          supplier_name: string | null
          supplier_siret: string | null
          template_id: string | null
          tokens_used: number | null
          total_ht: number | null
          total_paid: number | null
          total_ttc: number | null
          tva_amount: number | null
          tva_rate: number | null
          updated_at: string | null
          upload_token_id: string | null
          user_id: string
          zones_validated: boolean | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          description?: string | null
          detected_zones?: Json | null
          due_date?: string | null
          evoliz_error?: string | null
          evoliz_expense_id?: string | null
          evoliz_sent_at?: string | null
          evoliz_status?: string | null
          file_name: string
          file_path: string
          file_url?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          mime_type?: string | null
          ocr_error?: string | null
          ocr_result?: Json | null
          source?: string | null
          status?: string | null
          supplier_name?: string | null
          supplier_siret?: string | null
          template_id?: string | null
          tokens_used?: number | null
          total_ht?: number | null
          total_paid?: number | null
          total_ttc?: number | null
          tva_amount?: number | null
          tva_rate?: number | null
          updated_at?: string | null
          upload_token_id?: string | null
          user_id: string
          zones_validated?: boolean | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          description?: string | null
          detected_zones?: Json | null
          due_date?: string | null
          evoliz_error?: string | null
          evoliz_expense_id?: string | null
          evoliz_sent_at?: string | null
          evoliz_status?: string | null
          file_name?: string
          file_path?: string
          file_url?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          mime_type?: string | null
          ocr_error?: string | null
          ocr_result?: Json | null
          source?: string | null
          status?: string | null
          supplier_name?: string | null
          supplier_siret?: string | null
          template_id?: string | null
          tokens_used?: number | null
          total_ht?: number | null
          total_paid?: number | null
          total_ttc?: number | null
          tva_amount?: number | null
          tva_rate?: number | null
          updated_at?: string | null
          upload_token_id?: string | null
          user_id?: string
          zones_validated?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "incoming_invoices_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "supplier_ocr_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incoming_invoices_upload_token_id_fkey"
            columns: ["upload_token_id"]
            isOneToOne: false
            referencedRelation: "user_upload_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_photos: {
        Row: {
          annotated_photo_url: string | null
          created_at: string | null
          id: string
          photo_url: string
          zone_id: string
        }
        Insert: {
          annotated_photo_url?: string | null
          created_at?: string | null
          id?: string
          photo_url: string
          zone_id: string
        }
        Update: {
          annotated_photo_url?: string | null
          created_at?: string | null
          id?: string
          photo_url?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_photos_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "inspection_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_zones: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          inspection_id: string
          zone_name: string
          zone_type: string
        }
        Insert: {
          created_at?: string | null
          display_order: number
          id?: string
          inspection_id: string
          zone_name: string
          zone_type: string
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          inspection_id?: string
          zone_name?: string
          zone_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_zones_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vehicle_inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      mechanical_blocks: {
        Row: {
          audio_url: string | null
          chapter_id: string
          color: string | null
          content: string | null
          created_at: string | null
          height: number | null
          id: string
          image_url: string | null
          order_index: number | null
          position_x: number | null
          position_y: number | null
          title: string | null
          type: string
          updated_at: string | null
          width: number | null
        }
        Insert: {
          audio_url?: string | null
          chapter_id: string
          color?: string | null
          content?: string | null
          created_at?: string | null
          height?: number | null
          id?: string
          image_url?: string | null
          order_index?: number | null
          position_x?: number | null
          position_y?: number | null
          title?: string | null
          type?: string
          updated_at?: string | null
          width?: number | null
        }
        Update: {
          audio_url?: string | null
          chapter_id?: string
          color?: string | null
          content?: string | null
          created_at?: string | null
          height?: number | null
          id?: string
          image_url?: string | null
          order_index?: number | null
          position_x?: number | null
          position_y?: number | null
          title?: string | null
          type?: string
          updated_at?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mechanical_blocks_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "mechanical_chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      mechanical_chapters: {
        Row: {
          created_at: string | null
          gamme_id: string
          id: string
          is_expanded: boolean | null
          order_index: number | null
          parent_id: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          gamme_id: string
          id?: string
          is_expanded?: boolean | null
          order_index?: number | null
          parent_id?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          gamme_id?: string
          id?: string
          is_expanded?: boolean | null
          order_index?: number | null
          parent_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "mechanical_chapters_gamme_id_fkey"
            columns: ["gamme_id"]
            isOneToOne: false
            referencedRelation: "mechanical_gammes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mechanical_chapters_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "mechanical_chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      mechanical_edges: {
        Row: {
          animated: boolean | null
          chapter_id: string
          created_at: string | null
          edge_type: string | null
          id: string
          label: string | null
          source_block_id: string
          target_block_id: string
          updated_at: string | null
        }
        Insert: {
          animated?: boolean | null
          chapter_id: string
          created_at?: string | null
          edge_type?: string | null
          id?: string
          label?: string | null
          source_block_id: string
          target_block_id: string
          updated_at?: string | null
        }
        Update: {
          animated?: boolean | null
          chapter_id?: string
          created_at?: string | null
          edge_type?: string | null
          id?: string
          label?: string | null
          source_block_id?: string
          target_block_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mechanical_edges_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "mechanical_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mechanical_edges_source_block_id_fkey"
            columns: ["source_block_id"]
            isOneToOne: false
            referencedRelation: "mechanical_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mechanical_edges_target_block_id_fkey"
            columns: ["target_block_id"]
            isOneToOne: false
            referencedRelation: "mechanical_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      mechanical_gammes: {
        Row: {
          category: string | null
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          title: string
          updated_at: string | null
          user_id: string
          vehicle_brand: string | null
          vehicle_model: string | null
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          title: string
          updated_at?: string | null
          user_id: string
          vehicle_brand?: string | null
          vehicle_model?: string | null
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
          vehicle_brand?: string | null
          vehicle_model?: string | null
        }
        Relationships: []
      }
      mechanical_procedure_steps: {
        Row: {
          created_at: string | null
          description: string | null
          drawing_data: string | null
          duration_minutes: number | null
          id: string
          image_url: string | null
          notes: string | null
          procedure_id: string
          step_number: number
          title: string
          tools_required: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          drawing_data?: string | null
          duration_minutes?: number | null
          id?: string
          image_url?: string | null
          notes?: string | null
          procedure_id: string
          step_number: number
          title: string
          tools_required?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          drawing_data?: string | null
          duration_minutes?: number | null
          id?: string
          image_url?: string | null
          notes?: string | null
          procedure_id?: string
          step_number?: number
          title?: string
          tools_required?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mechanical_procedure_steps_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "mechanical_procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      mechanical_procedures: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          title: string
          updated_at: string | null
          user_id: string
          vehicle_brand: string
          vehicle_model: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          title: string
          updated_at?: string | null
          user_id: string
          vehicle_brand: string
          vehicle_model?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
          vehicle_brand?: string
          vehicle_model?: string | null
        }
        Relationships: []
      }
      notices_database: {
        Row: {
          ai_summary: string | null
          ai_summary_generated_at: string | null
          ai_summary_tokens_used: number | null
          annee: string | null
          categorie: string | null
          created_at: string | null
          description: string | null
          id: string
          indexed_at: string | null
          is_indexed: boolean | null
          marque: string
          modele: string
          notice_url: string
          tags: string[] | null
          titre: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_summary?: string | null
          ai_summary_generated_at?: string | null
          ai_summary_tokens_used?: number | null
          annee?: string | null
          categorie?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          indexed_at?: string | null
          is_indexed?: boolean | null
          marque: string
          modele: string
          notice_url: string
          tags?: string[] | null
          titre: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_summary?: string | null
          ai_summary_generated_at?: string | null
          ai_summary_tokens_used?: number | null
          annee?: string | null
          categorie?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          indexed_at?: string | null
          is_indexed?: boolean | null
          marque?: string
          modele?: string
          notice_url?: string
          tags?: string[] | null
          titre?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      official_document_categories: {
        Row: {
          color: string
          created_at: string | null
          display_order: number
          icon: string
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string
          created_at?: string | null
          display_order?: number
          icon?: string
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          display_order?: number
          icon?: string
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      official_documents: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          file_url: string
          id: string
          indexed_at: string | null
          is_active: boolean | null
          is_indexed: boolean | null
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
          indexed_at?: string | null
          is_active?: boolean | null
          is_indexed?: boolean | null
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
          indexed_at?: string | null
          is_active?: boolean | null
          is_indexed?: boolean | null
          name?: string
          updated_at?: string | null
          version?: string | null
        }
        Relationships: []
      }
      photo_templates: {
        Row: {
          accuracy_mm: number | null
          calibration_data: Json | null
          corrected_image_url: string | null
          created_at: string | null
          description: string | null
          drawings_data: Json | null
          export_count: number | null
          id: string
          last_exported_at: string | null
          marker_ids: number[] | null
          markers_detected: number | null
          markers_image_url: string | null
          material: string | null
          name: string
          original_image_url: string
          project_id: string
          scale_factor: number | null
          tags: string[] | null
          thickness_mm: number | null
          type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          accuracy_mm?: number | null
          calibration_data?: Json | null
          corrected_image_url?: string | null
          created_at?: string | null
          description?: string | null
          drawings_data?: Json | null
          export_count?: number | null
          id?: string
          last_exported_at?: string | null
          marker_ids?: number[] | null
          markers_detected?: number | null
          markers_image_url?: string | null
          material?: string | null
          name: string
          original_image_url: string
          project_id: string
          scale_factor?: number | null
          tags?: string[] | null
          thickness_mm?: number | null
          type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          accuracy_mm?: number | null
          calibration_data?: Json | null
          corrected_image_url?: string | null
          created_at?: string | null
          description?: string | null
          drawings_data?: Json | null
          export_count?: number | null
          id?: string
          last_exported_at?: string | null
          marker_ids?: number[] | null
          markers_detected?: number | null
          markers_image_url?: string | null
          material?: string | null
          name?: string
          original_image_url?: string
          project_id?: string
          scale_factor?: number | null
          tags?: string[] | null
          thickness_mm?: number | null
          type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          accessory_id: string
          id: string
          notes: string | null
          prix_public_ttc: number | null
          prix_reference: number | null
          recorded_at: string | null
          source: string | null
          user_id: string
        }
        Insert: {
          accessory_id: string
          id?: string
          notes?: string | null
          prix_public_ttc?: number | null
          prix_reference?: number | null
          recorded_at?: string | null
          source?: string | null
          user_id: string
        }
        Update: {
          accessory_id?: string
          id?: string
          notes?: string | null
          prix_public_ttc?: number | null
          prix_reference?: number | null
          recorded_at?: string | null
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "accessories_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      product_groups: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          marque: string | null
          nom: string
          reference_fabricant: string
          specs_communes: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          marque?: string | null
          nom: string
          reference_fabricant: string
          specs_communes?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          marque?: string | null
          nom?: string
          reference_fabricant?: string
          specs_communes?: Json | null
          updated_at?: string | null
          user_id?: string | null
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
          date_archivage: string | null
          date_paiement: string | null
          delai_paiement: string | null
          description: string | null
          est_archive: boolean | null
          evoliz_item_id: string | null
          expense_date: string | null
          facture_url: string | null
          fournisseur: string | null
          hauteur_mm: number | null
          id: string
          imported_from_evoliz: boolean | null
          incoming_invoice_id: string | null
          intensite_amperes: number | null
          invoice_number: string | null
          largeur_mm: number | null
          longueur_mm: number | null
          marque: string | null
          nom_accessoire: string | null
          notes: string | null
          order_date: string | null
          payment_status: string | null
          poids_kg: number | null
          prix: number | null
          prix_unitaire: number | null
          prix_vente_ttc: number | null
          product_name: string | null
          project_id: string | null
          puissance_watts: number | null
          quantite: number | null
          quantity: number | null
          raison_archivage: string | null
          remplace_par_id: string | null
          scenario_id: string | null
          statut_livraison: string | null
          statut_paiement: string | null
          supplier: string | null
          supplier_id: string | null
          temps_production_heures: number | null
          temps_utilisation_heures: number | null
          todo_id: string | null
          total_amount: number | null
          type_electrique: string | null
          unit_price: number | null
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
          date_archivage?: string | null
          date_paiement?: string | null
          delai_paiement?: string | null
          description?: string | null
          est_archive?: boolean | null
          evoliz_item_id?: string | null
          expense_date?: string | null
          facture_url?: string | null
          fournisseur?: string | null
          hauteur_mm?: number | null
          id?: string
          imported_from_evoliz?: boolean | null
          incoming_invoice_id?: string | null
          intensite_amperes?: number | null
          invoice_number?: string | null
          largeur_mm?: number | null
          longueur_mm?: number | null
          marque?: string | null
          nom_accessoire?: string | null
          notes?: string | null
          order_date?: string | null
          payment_status?: string | null
          poids_kg?: number | null
          prix?: number | null
          prix_unitaire?: number | null
          prix_vente_ttc?: number | null
          product_name?: string | null
          project_id?: string | null
          puissance_watts?: number | null
          quantite?: number | null
          quantity?: number | null
          raison_archivage?: string | null
          remplace_par_id?: string | null
          scenario_id?: string | null
          statut_livraison?: string | null
          statut_paiement?: string | null
          supplier?: string | null
          supplier_id?: string | null
          temps_production_heures?: number | null
          temps_utilisation_heures?: number | null
          todo_id?: string | null
          total_amount?: number | null
          type_electrique?: string | null
          unit_price?: number | null
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
          date_archivage?: string | null
          date_paiement?: string | null
          delai_paiement?: string | null
          description?: string | null
          est_archive?: boolean | null
          evoliz_item_id?: string | null
          expense_date?: string | null
          facture_url?: string | null
          fournisseur?: string | null
          hauteur_mm?: number | null
          id?: string
          imported_from_evoliz?: boolean | null
          incoming_invoice_id?: string | null
          intensite_amperes?: number | null
          invoice_number?: string | null
          largeur_mm?: number | null
          longueur_mm?: number | null
          marque?: string | null
          nom_accessoire?: string | null
          notes?: string | null
          order_date?: string | null
          payment_status?: string | null
          poids_kg?: number | null
          prix?: number | null
          prix_unitaire?: number | null
          prix_vente_ttc?: number | null
          product_name?: string | null
          project_id?: string | null
          puissance_watts?: number | null
          quantite?: number | null
          quantity?: number | null
          raison_archivage?: string | null
          remplace_par_id?: string | null
          scenario_id?: string | null
          statut_livraison?: string | null
          statut_paiement?: string | null
          supplier?: string | null
          supplier_id?: string | null
          temps_production_heures?: number | null
          temps_utilisation_heures?: number | null
          todo_id?: string | null
          total_amount?: number | null
          type_electrique?: string | null
          unit_price?: number | null
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
          {
            foreignKeyName: "project_expenses_incoming_invoice_id_fkey"
            columns: ["incoming_invoice_id"]
            isOneToOne: false
            referencedRelation: "incoming_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expenses_incoming_invoice_id_fkey"
            columns: ["incoming_invoice_id"]
            isOneToOne: false
            referencedRelation: "view_incoming_invoices_with_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expenses_remplace_par_id_fkey"
            columns: ["remplace_par_id"]
            isOneToOne: false
            referencedRelation: "project_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expenses_remplace_par_id_fkey"
            columns: ["remplace_par_id"]
            isOneToOne: false
            referencedRelation: "view_expenses_with_scenario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expenses_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "project_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expenses_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "project_todos"
            referencedColumns: ["id"]
          },
        ]
      }
      project_expenses_history: {
        Row: {
          action: string
          ancienne_depense_json: Json
          date_modification: string | null
          expense_id: string | null
          id: string
          modifie_par_user_id: string | null
          project_id: string
          raison_changement: string | null
          remplace_par_id: string | null
          scenario_id: string | null
        }
        Insert: {
          action: string
          ancienne_depense_json: Json
          date_modification?: string | null
          expense_id?: string | null
          id?: string
          modifie_par_user_id?: string | null
          project_id: string
          raison_changement?: string | null
          remplace_par_id?: string | null
          scenario_id?: string | null
        }
        Update: {
          action?: string
          ancienne_depense_json?: Json
          date_modification?: string | null
          expense_id?: string | null
          id?: string
          modifie_par_user_id?: string | null
          project_id?: string
          raison_changement?: string | null
          remplace_par_id?: string | null
          scenario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_expenses_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expenses_history_remplace_par_id_fkey"
            columns: ["remplace_par_id"]
            isOneToOne: false
            referencedRelation: "project_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expenses_history_remplace_par_id_fkey"
            columns: ["remplace_par_id"]
            isOneToOne: false
            referencedRelation: "view_expenses_with_scenario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expenses_history_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "project_scenarios"
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
      project_monthly_charges: {
        Row: {
          created_at: string | null
          id: string
          jour_mois: number
          montant: number
          nom_charge: string
          project_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          jour_mois: number
          montant: number
          nom_charge: string
          project_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          jour_mois?: number
          montant?: number
          nom_charge?: string
          project_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_monthly_charges_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_notes: {
        Row: {
          archived: boolean | null
          content: string | null
          created_at: string | null
          id: string
          project_id: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          archived?: boolean | null
          content?: string | null
          created_at?: string | null
          id?: string
          project_id: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          archived?: boolean | null
          content?: string | null
          created_at?: string | null
          id?: string
          project_id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
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
          created_at: string | null
          date_paiement: string
          id: string
          mode_paiement: string | null
          montant: number
          notes: string | null
          project_id: string
          type_paiement: string | null
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
          type_paiement?: string | null
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
          type_paiement?: string | null
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
      project_photos: {
        Row: {
          annotations: Json | null
          created_at: string | null
          description: string | null
          id: string
          photo_url: string
          project_id: string
          type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          annotations?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          photo_url: string
          project_id: string
          type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          annotations?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          photo_url?: string
          project_id?: string
          type?: string | null
          updated_at?: string | null
          user_id?: string
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
      project_scenarios: {
        Row: {
          couleur: string | null
          created_at: string | null
          est_principal: boolean | null
          icone: string | null
          id: string
          is_locked: boolean | null
          nom: string
          ordre: number | null
          project_id: string
          updated_at: string | null
        }
        Insert: {
          couleur?: string | null
          created_at?: string | null
          est_principal?: boolean | null
          icone?: string | null
          id?: string
          is_locked?: boolean | null
          nom: string
          ordre?: number | null
          project_id: string
          updated_at?: string | null
        }
        Update: {
          couleur?: string | null
          created_at?: string | null
          est_principal?: boolean | null
          icone?: string | null
          id?: string
          is_locked?: boolean | null
          nom?: string
          ordre?: number | null
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_scenarios_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_todo_subtasks: {
        Row: {
          completed: boolean | null
          created_at: string
          display_order: number | null
          id: string
          title: string
          todo_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string
          display_order?: number | null
          id?: string
          title: string
          todo_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string
          display_order?: number | null
          id?: string
          title?: string
          todo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_todo_subtasks_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "project_todos"
            referencedColumns: ["id"]
          },
        ]
      }
      project_todos: {
        Row: {
          accessory_id: string | null
          actual_hours: number | null
          blocked_reason: string | null
          category_id: string | null
          completed: boolean | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          due_date: string | null
          estimated_hours: number | null
          evoliz_item_id: string | null
          forfait_ttc: number | null
          id: string
          imported_from_evoliz: boolean | null
          notes: string | null
          priority: string | null
          project_id: string | null
          requires_delivery_id: string | null
          scheduled_date: string | null
          task_type: string | null
          template_id: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          accessory_id?: string | null
          actual_hours?: number | null
          blocked_reason?: string | null
          category_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          due_date?: string | null
          estimated_hours?: number | null
          evoliz_item_id?: string | null
          forfait_ttc?: number | null
          id?: string
          imported_from_evoliz?: boolean | null
          notes?: string | null
          priority?: string | null
          project_id?: string | null
          requires_delivery_id?: string | null
          scheduled_date?: string | null
          task_type?: string | null
          template_id?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          accessory_id?: string | null
          actual_hours?: number | null
          blocked_reason?: string | null
          category_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          due_date?: string | null
          estimated_hours?: number | null
          evoliz_item_id?: string | null
          forfait_ttc?: number | null
          id?: string
          imported_from_evoliz?: boolean | null
          notes?: string | null
          priority?: string | null
          project_id?: string | null
          requires_delivery_id?: string | null
          scheduled_date?: string | null
          task_type?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_todos_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "accessories_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_todos_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "work_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_todos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_todos_requires_delivery_id_fkey"
            columns: ["requires_delivery_id"]
            isOneToOne: false
            referencedRelation: "supplier_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_todos_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
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
          carrosserie_ce: string | null
          carrosserie_nationale: string | null
          categorie_international: string | null
          charge_utile_kg: number | null
          clargeur_mm: number | null
          client_id: string | null
          client_name: string | null
          co2_emission: number | null
          code_postal_proprietaire: string | null
          commentaires_dreal: string | null
          created_at: string | null
          created_by: string | null
          cylindree: number | null
          date_encaissement_acompte: string | null
          date_premiere_circulation: string | null
          date_premiere_immatriculation: string | null
          date_validation_devis: string | null
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
          is_professional: boolean | null
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
          montant_acompte: number | null
          name: string | null
          nom: string
          nom_projet: string | null
          nom_proprietaire: string | null
          nombre_places: number | null
          norme_euro: string | null
          notes_rti: string | null
          numero_chassis: string | null
          numero_chassis_vin: string | null
          numero_reception_ce: string | null
          photo_url: string | null
          places_assises_origine: number | null
          poids_vide_kg: number | null
          prenom_proprietaire: string | null
          ptac_kg: number | null
          ptra: number | null
          puissance_fiscale: number | null
          puissance_kw: number | null
          rti_status: string | null
          rti_submission_date: string | null
          rti_validation_date: string | null
          seats_added: number | null
          seats_after_transformation: number | null
          seats_technical_ref: string | null
          seats_type: string | null
          sleeping_places: number | null
          start_date: string | null
          status: string | null
          statut: string | null
          statut_financier: string | null
          telephone_proprietaire: string | null
          type_mine: string | null
          type_variante: string | null
          user_id: string | null
          vehicle_catalog_id: string | null
          vehicle_catalog_id_v2: string | null
          vehicle_model: string | null
          ville_proprietaire: string | null
          vin: string | null
          work_description: string | null
        }
        Insert: {
          adresse_proprietaire?: string | null
          budget?: number | null
          budget_total?: number | null
          carrosserie?: string | null
          carrosserie_ce?: string | null
          carrosserie_nationale?: string | null
          categorie_international?: string | null
          charge_utile_kg?: number | null
          clargeur_mm?: number | null
          client_id?: string | null
          client_name?: string | null
          co2_emission?: number | null
          code_postal_proprietaire?: string | null
          commentaires_dreal?: string | null
          created_at?: string | null
          created_by?: string | null
          cylindree?: number | null
          date_encaissement_acompte?: string | null
          date_premiere_circulation?: string | null
          date_premiere_immatriculation?: string | null
          date_validation_devis?: string | null
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
          is_professional?: boolean | null
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
          montant_acompte?: number | null
          name?: string | null
          nom: string
          nom_projet?: string | null
          nom_proprietaire?: string | null
          nombre_places?: number | null
          norme_euro?: string | null
          notes_rti?: string | null
          numero_chassis?: string | null
          numero_chassis_vin?: string | null
          numero_reception_ce?: string | null
          photo_url?: string | null
          places_assises_origine?: number | null
          poids_vide_kg?: number | null
          prenom_proprietaire?: string | null
          ptac_kg?: number | null
          ptra?: number | null
          puissance_fiscale?: number | null
          puissance_kw?: number | null
          rti_status?: string | null
          rti_submission_date?: string | null
          rti_validation_date?: string | null
          seats_added?: number | null
          seats_after_transformation?: number | null
          seats_technical_ref?: string | null
          seats_type?: string | null
          sleeping_places?: number | null
          start_date?: string | null
          status?: string | null
          statut?: string | null
          statut_financier?: string | null
          telephone_proprietaire?: string | null
          type_mine?: string | null
          type_variante?: string | null
          user_id?: string | null
          vehicle_catalog_id?: string | null
          vehicle_catalog_id_v2?: string | null
          vehicle_model?: string | null
          ville_proprietaire?: string | null
          vin?: string | null
          work_description?: string | null
        }
        Update: {
          adresse_proprietaire?: string | null
          budget?: number | null
          budget_total?: number | null
          carrosserie?: string | null
          carrosserie_ce?: string | null
          carrosserie_nationale?: string | null
          categorie_international?: string | null
          charge_utile_kg?: number | null
          clargeur_mm?: number | null
          client_id?: string | null
          client_name?: string | null
          co2_emission?: number | null
          code_postal_proprietaire?: string | null
          commentaires_dreal?: string | null
          created_at?: string | null
          created_by?: string | null
          cylindree?: number | null
          date_encaissement_acompte?: string | null
          date_premiere_circulation?: string | null
          date_premiere_immatriculation?: string | null
          date_validation_devis?: string | null
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
          is_professional?: boolean | null
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
          montant_acompte?: number | null
          name?: string | null
          nom?: string
          nom_projet?: string | null
          nom_proprietaire?: string | null
          nombre_places?: number | null
          norme_euro?: string | null
          notes_rti?: string | null
          numero_chassis?: string | null
          numero_chassis_vin?: string | null
          numero_reception_ce?: string | null
          photo_url?: string | null
          places_assises_origine?: number | null
          poids_vide_kg?: number | null
          prenom_proprietaire?: string | null
          ptac_kg?: number | null
          ptra?: number | null
          puissance_fiscale?: number | null
          puissance_kw?: number | null
          rti_status?: string | null
          rti_submission_date?: string | null
          rti_validation_date?: string | null
          seats_added?: number | null
          seats_after_transformation?: number | null
          seats_technical_ref?: string | null
          seats_type?: string | null
          sleeping_places?: number | null
          start_date?: string | null
          status?: string | null
          statut?: string | null
          statut_financier?: string | null
          telephone_proprietaire?: string | null
          type_mine?: string | null
          type_variante?: string | null
          user_id?: string | null
          vehicle_catalog_id?: string | null
          vehicle_catalog_id_v2?: string | null
          vehicle_model?: string | null
          ville_proprietaire?: string | null
          vin?: string | null
          work_description?: string | null
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
      shipping_fee_tiers: {
        Row: {
          created_at: string | null
          id: string
          quantity_from: number
          quantity_to: number | null
          shipping_fee_id: string
          total_price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          quantity_from: number
          quantity_to?: number | null
          shipping_fee_id: string
          total_price: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          quantity_from?: number
          quantity_to?: number | null
          shipping_fee_id?: string
          total_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_fee_tiers_shipping_fee_id_fkey"
            columns: ["shipping_fee_id"]
            isOneToOne: false
            referencedRelation: "shipping_fees"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_fees: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          montant: number
          nom: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          montant: number
          nom: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          montant?: number
          nom?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      shop_categories: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          nom: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          nom: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          nom?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      shop_custom_kit_accessories: {
        Row: {
          accessory_id: string
          created_at: string | null
          custom_kit_id: string
          default_quantity: number
          id: string
        }
        Insert: {
          accessory_id: string
          created_at?: string | null
          custom_kit_id: string
          default_quantity?: number
          id?: string
        }
        Update: {
          accessory_id?: string
          created_at?: string | null
          custom_kit_id?: string
          default_quantity?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_custom_kit_accessories_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "accessories_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_custom_kit_accessories_custom_kit_id_fkey"
            columns: ["custom_kit_id"]
            isOneToOne: false
            referencedRelation: "shop_custom_kits"
            referencedColumns: ["id"]
          },
        ]
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
          id: string
          notes: string | null
          order_number: string
          payment_method: string | null
          status: string | null
          total_amount: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          added_to_expenses?: boolean | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          order_number: string
          payment_method?: string | null
          status?: string | null
          total_amount?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          added_to_expenses?: boolean | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: string | null
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
          created_at: string | null
          default_quantity: number | null
          id: string
          is_required: boolean | null
          quantity: number
          shop_product_id: string
        }
        Insert: {
          accessory_id: string
          created_at?: string | null
          default_quantity?: number | null
          id?: string
          is_required?: boolean | null
          quantity?: number
          shop_product_id: string
        }
        Update: {
          accessory_id?: string
          created_at?: string | null
          default_quantity?: number | null
          id?: string
          is_required?: boolean | null
          quantity?: number
          shop_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_product_accessories_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "accessories_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_product_accessories_product_id_fkey"
            columns: ["shop_product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_products: {
        Row: {
          category_id: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          nom: string
          prix_base: number
          product_type: string
          stock_quantity: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          nom: string
          prix_base?: number
          product_type: string
          stock_quantity?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          nom?: string
          prix_base?: number
          product_type?: string
          stock_quantity?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "shop_categories"
            referencedColumns: ["id"]
          },
        ]
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
      supplier_ocr_templates: {
        Row: {
          created_at: string | null
          field_zones: Json
          id: string
          identification_patterns: Json | null
          last_used_at: string | null
          success_rate: number | null
          supplier_name: string
          supplier_name_normalized: string | null
          supplier_siret: string | null
          times_used: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          field_zones?: Json
          id?: string
          identification_patterns?: Json | null
          last_used_at?: string | null
          success_rate?: number | null
          supplier_name: string
          supplier_name_normalized?: string | null
          supplier_siret?: string | null
          times_used?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          field_zones?: Json
          id?: string
          identification_patterns?: Json | null
          last_used_at?: string | null
          success_rate?: number | null
          supplier_name?: string
          supplier_name_normalized?: string | null
          supplier_siret?: string | null
          times_used?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
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
          notes?: string | null
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
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      task_templates: {
        Row: {
          category_id: string | null
          created_at: string | null
          description: string | null
          estimated_hours: number | null
          id: string
          is_global: boolean | null
          title: string
          usage_count: number | null
          user_id: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_global?: boolean | null
          title: string
          usage_count?: number | null
          user_id?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_global?: boolean | null
          title?: string
          usage_count?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "work_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_schemas: {
        Row: {
          created_at: string | null
          id: string
          project_id: string
          schema_data: Json
          schema_name: string
          schema_number: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          project_id: string
          schema_data: Json
          schema_name: string
          schema_number?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          project_id?: string
          schema_data?: Json
          schema_name?: string
          schema_number?: number
          updated_at?: string | null
          user_id?: string
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
      transformer_settings: {
        Row: {
          address: string | null
          ape_code: string | null
          certification_expiry: string | null
          certification_number: string | null
          city: string | null
          company_name: string | null
          country: string | null
          created_at: string | null
          default_location: string | null
          default_motif: string | null
          email: string | null
          hourly_rate_ttc: number | null
          id: string
          legal_form: string | null
          owner_civility: string | null
          owner_first_name: string | null
          owner_last_name: string | null
          owner_title: string | null
          phone: string | null
          postal_code: string | null
          siret: string | null
          updated_at: string | null
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          ape_code?: string | null
          certification_expiry?: string | null
          certification_number?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          default_location?: string | null
          default_motif?: string | null
          email?: string | null
          hourly_rate_ttc?: number | null
          id?: string
          legal_form?: string | null
          owner_civility?: string | null
          owner_first_name?: string | null
          owner_last_name?: string | null
          owner_title?: string | null
          phone?: string | null
          postal_code?: string | null
          siret?: string | null
          updated_at?: string | null
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          ape_code?: string | null
          certification_expiry?: string | null
          certification_number?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          default_location?: string | null
          default_motif?: string | null
          email?: string | null
          hourly_rate_ttc?: number | null
          id?: string
          legal_form?: string | null
          owner_civility?: string | null
          owner_first_name?: string | null
          owner_last_name?: string | null
          owner_title?: string | null
          phone?: string | null
          postal_code?: string | null
          siret?: string | null
          updated_at?: string | null
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      user_ai_config: {
        Row: {
          created_at: string | null
          daily_limit: number | null
          encrypted_api_key: string | null
          id: string
          provider: string
          updated_at: string | null
          user_id: string
          warning_threshold: number | null
        }
        Insert: {
          created_at?: string | null
          daily_limit?: number | null
          encrypted_api_key?: string | null
          id?: string
          provider?: string
          updated_at?: string | null
          user_id: string
          warning_threshold?: number | null
        }
        Update: {
          created_at?: string | null
          daily_limit?: number | null
          encrypted_api_key?: string | null
          id?: string
          provider?: string
          updated_at?: string | null
          user_id?: string
          warning_threshold?: number | null
        }
        Relationships: []
      }
      user_ai_settings: {
        Row: {
          anthropic_api_key: string | null
          created_at: string | null
          default_provider: string | null
          gemini_api_key: string | null
          id: string
          mistral_api_key: string | null
          openai_api_key: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          anthropic_api_key?: string | null
          created_at?: string | null
          default_provider?: string | null
          gemini_api_key?: string | null
          id?: string
          mistral_api_key?: string | null
          openai_api_key?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          anthropic_api_key?: string | null
          created_at?: string | null
          default_provider?: string | null
          gemini_api_key?: string | null
          id?: string
          mistral_api_key?: string | null
          openai_api_key?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_filled_documents: {
        Row: {
          created_at: string | null
          document_name: string
          filled_data: Json
          id: string
          pdf_url: string | null
          project_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          document_name: string
          filled_data: Json
          id?: string
          pdf_url?: string | null
          project_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          document_name?: string
          filled_data?: Json
          id?: string
          pdf_url?: string | null
          project_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_filled_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_logins: {
        Row: {
          created_at: string | null
          id: string
          ip_address: string | null
          login_at: string | null
          user_agent: string | null
          user_email: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          login_at?: string | null
          user_agent?: string | null
          user_email: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          login_at?: string | null
          user_agent?: string | null
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          company_address: string | null
          company_city: string | null
          company_country: string | null
          company_name: string | null
          company_postal_code: string | null
          company_siret: string | null
          created_at: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_end_date: string | null
          subscription_start_date: string | null
          subscription_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company_address?: string | null
          company_city?: string | null
          company_country?: string | null
          company_name?: string | null
          company_postal_code?: string | null
          company_siret?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          subscription_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company_address?: string | null
          company_city?: string | null
          company_country?: string | null
          company_name?: string | null
          company_postal_code?: string | null
          company_siret?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          subscription_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_suppliers: {
        Row: {
          created_at: string | null
          domain: string
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          price_is_ht: boolean | null
          public_price_is_ttc: boolean | null
          requires_login: boolean | null
          selector_brand: string | null
          selector_brand_filter: string | null
          selector_capacite: string | null
          selector_description: string | null
          selector_dimensions: string | null
          selector_image: string | null
          selector_list_brand: string | null
          selector_list_card: string | null
          selector_list_image: string | null
          selector_list_link: string | null
          selector_list_name: string | null
          selector_list_price: string | null
          selector_list_public_price: string | null
          selector_poids: string | null
          selector_price: string | null
          selector_product_name: string | null
          selector_public_price: string | null
          selector_puissance: string | null
          selector_reference: string | null
          selector_tension: string | null
          selector_volume: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          domain: string
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          price_is_ht?: boolean | null
          public_price_is_ttc?: boolean | null
          requires_login?: boolean | null
          selector_brand?: string | null
          selector_brand_filter?: string | null
          selector_capacite?: string | null
          selector_description?: string | null
          selector_dimensions?: string | null
          selector_image?: string | null
          selector_list_brand?: string | null
          selector_list_card?: string | null
          selector_list_image?: string | null
          selector_list_link?: string | null
          selector_list_name?: string | null
          selector_list_price?: string | null
          selector_list_public_price?: string | null
          selector_poids?: string | null
          selector_price?: string | null
          selector_product_name?: string | null
          selector_public_price?: string | null
          selector_puissance?: string | null
          selector_reference?: string | null
          selector_tension?: string | null
          selector_volume?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          domain?: string
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          price_is_ht?: boolean | null
          public_price_is_ttc?: boolean | null
          requires_login?: boolean | null
          selector_brand?: string | null
          selector_brand_filter?: string | null
          selector_capacite?: string | null
          selector_description?: string | null
          selector_dimensions?: string | null
          selector_image?: string | null
          selector_list_brand?: string | null
          selector_list_card?: string | null
          selector_list_image?: string | null
          selector_list_link?: string | null
          selector_list_name?: string | null
          selector_list_price?: string | null
          selector_list_public_price?: string | null
          selector_poids?: string | null
          selector_price?: string | null
          selector_product_name?: string | null
          selector_public_price?: string | null
          selector_puissance?: string | null
          selector_reference?: string | null
          selector_tension?: string | null
          selector_volume?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_upload_tokens: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          name: string | null
          token: string
          use_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string | null
          token: string
          use_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string | null
          token?: string
          use_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      vehicle_damages: {
        Row: {
          created_at: string | null
          description: string
          id: string
          inspection_id: string
          photo_url: string | null
          severity: string
          zone_id: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          inspection_id: string
          photo_url?: string | null
          severity: string
          zone_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          inspection_id?: string
          photo_url?: string | null
          severity?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_damages_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vehicle_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_damages_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "inspection_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_inspections: {
        Row: {
          client_signature_url: string | null
          created_at: string | null
          fuel_level: string | null
          id: string
          inspection_date: string
          keys_provided: boolean | null
          mileage: number | null
          notes: string | null
          pdf_url: string | null
          project_id: string
          signed_at: string | null
          signed_by: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          client_signature_url?: string | null
          created_at?: string | null
          fuel_level?: string | null
          id?: string
          inspection_date?: string
          keys_provided?: boolean | null
          mileage?: number | null
          notes?: string | null
          pdf_url?: string | null
          project_id: string
          signed_at?: string | null
          signed_by?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          client_signature_url?: string | null
          created_at?: string | null
          fuel_level?: string | null
          id?: string
          inspection_date?: string
          keys_provided?: boolean | null
          mileage?: number | null
          notes?: string | null
          pdf_url?: string | null
          project_id?: string
          signed_at?: string | null
          signed_by?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_inspections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_registration: {
        Row: {
          body_type: string | null
          carrosserie: string | null
          co2: number | null
          co2_emission: number | null
          commercial_name: string | null
          created_at: string | null
          cylindree: number | null
          date_premiere_immatriculation: string | null
          energie: string | null
          engine_capacity: number | null
          environmental_class: string | null
          fiscal_power: number | null
          genre: string | null
          id: string
          immatriculation: string | null
          international_category: string | null
          marque: string | null
          max_braked_trailer: number | null
          max_power_kw: number | null
          max_trailer_weight: number | null
          max_weight_axle1: number | null
          max_weight_axle2: number | null
          modele: string | null
          original_seats: number | null
          places_assises: number | null
          poids_vide: number | null
          project_id: string | null
          ptac: number | null
          puissance_fiscale: number | null
          standing_places: number | null
          type: string | null
          updated_at: string | null
          vin: string | null
        }
        Insert: {
          body_type?: string | null
          carrosserie?: string | null
          co2?: number | null
          co2_emission?: number | null
          commercial_name?: string | null
          created_at?: string | null
          cylindree?: number | null
          date_premiere_immatriculation?: string | null
          energie?: string | null
          engine_capacity?: number | null
          environmental_class?: string | null
          fiscal_power?: number | null
          genre?: string | null
          id?: string
          immatriculation?: string | null
          international_category?: string | null
          marque?: string | null
          max_braked_trailer?: number | null
          max_power_kw?: number | null
          max_trailer_weight?: number | null
          max_weight_axle1?: number | null
          max_weight_axle2?: number | null
          modele?: string | null
          original_seats?: number | null
          places_assises?: number | null
          poids_vide?: number | null
          project_id?: string | null
          ptac?: number | null
          puissance_fiscale?: number | null
          standing_places?: number | null
          type?: string | null
          updated_at?: string | null
          vin?: string | null
        }
        Update: {
          body_type?: string | null
          carrosserie?: string | null
          co2?: number | null
          co2_emission?: number | null
          commercial_name?: string | null
          created_at?: string | null
          cylindree?: number | null
          date_premiere_immatriculation?: string | null
          energie?: string | null
          engine_capacity?: number | null
          environmental_class?: string | null
          fiscal_power?: number | null
          genre?: string | null
          id?: string
          immatriculation?: string | null
          international_category?: string | null
          marque?: string | null
          max_braked_trailer?: number | null
          max_power_kw?: number | null
          max_trailer_weight?: number | null
          max_weight_axle1?: number | null
          max_weight_axle2?: number | null
          modele?: string | null
          original_seats?: number | null
          places_assises?: number | null
          poids_vide?: number | null
          project_id?: string | null
          ptac?: number | null
          puissance_fiscale?: number | null
          standing_places?: number | null
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
          created_at: string | null
          dimension: string | null
          hauteur_mm: number | null
          id: string
          largeur_chargement_mm: number | null
          largeur_mm: number | null
          longueur_chargement_mm: number | null
          longueur_mm: number | null
          marque: string
          modele: string
          poids_vide_kg: number | null
          ptac_kg: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dimension?: string | null
          hauteur_mm?: number | null
          id?: string
          largeur_chargement_mm?: number | null
          largeur_mm?: number | null
          longueur_chargement_mm?: number | null
          longueur_mm?: number | null
          marque: string
          modele: string
          poids_vide_kg?: number | null
          ptac_kg?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dimension?: string | null
          hauteur_mm?: number | null
          id?: string
          largeur_chargement_mm?: number | null
          largeur_mm?: number | null
          longueur_chargement_mm?: number | null
          longueur_mm?: number | null
          marque?: string
          modele?: string
          poids_vide_kg?: number | null
          ptac_kg?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      wishlist_categories: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          category_id: string | null
          created_at: string
          estimated_price: number | null
          id: string
          ordered_at: string | null
          priority: number | null
          product_url: string | null
          project_id: string | null
          received_at: string | null
          status: string
          supplier: string | null
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          estimated_price?: number | null
          id?: string
          ordered_at?: string | null
          priority?: number | null
          product_url?: string | null
          project_id?: string | null
          received_at?: string | null
          status?: string
          supplier?: string | null
          text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          estimated_price?: number | null
          id?: string
          ordered_at?: string | null
          priority?: number | null
          product_url?: string | null
          project_id?: string | null
          received_at?: string | null
          status?: string
          supplier?: string | null
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "wishlist_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      work_categories: {
        Row: {
          color: string | null
          created_at: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_template: boolean | null
          name: string
          project_id: string | null
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_template?: boolean | null
          name: string
          project_id?: string | null
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_template?: boolean | null
          name?: string
          project_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_categories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      view_expenses_with_scenario: {
        Row: {
          accessory_id: string | null
          amount: number | null
          categorie: string | null
          category: string | null
          created_at: string | null
          date_achat: string | null
          date_archivage: string | null
          date_paiement: string | null
          delai_paiement: string | null
          description: string | null
          est_archive: boolean | null
          expense_date: string | null
          facture_url: string | null
          fournisseur: string | null
          hauteur_mm: number | null
          id: string | null
          intensite_amperes: number | null
          invoice_number: string | null
          largeur_mm: number | null
          longueur_mm: number | null
          marque: string | null
          nom_accessoire: string | null
          notes: string | null
          order_date: string | null
          payment_status: string | null
          poids_kg: number | null
          prix: number | null
          prix_unitaire: number | null
          prix_vente_ttc: number | null
          product_name: string | null
          project_date_validation: string | null
          project_id: string | null
          project_statut: string | null
          puissance_watts: number | null
          quantite: number | null
          quantity: number | null
          raison_archivage: string | null
          remplace_par_id: string | null
          scenario_couleur: string | null
          scenario_est_principal: boolean | null
          scenario_icone: string | null
          scenario_id: string | null
          scenario_nom: string | null
          statut_livraison: string | null
          statut_paiement: string | null
          supplier: string | null
          supplier_id: string | null
          temps_production_heures: number | null
          temps_utilisation_heures: number | null
          todo_id: string | null
          total_amount: number | null
          type_electrique: string | null
          unit_price: number | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_project_expenses_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expenses_remplace_par_id_fkey"
            columns: ["remplace_par_id"]
            isOneToOne: false
            referencedRelation: "project_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expenses_remplace_par_id_fkey"
            columns: ["remplace_par_id"]
            isOneToOne: false
            referencedRelation: "view_expenses_with_scenario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expenses_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "project_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expenses_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "project_todos"
            referencedColumns: ["id"]
          },
        ]
      }
      view_incoming_invoices_with_payments: {
        Row: {
          amount_linked: number | null
          confidence: number | null
          created_at: string | null
          description: string | null
          due_date: string | null
          evoliz_error: string | null
          evoliz_expense_id: string | null
          evoliz_sent_at: string | null
          evoliz_status: string | null
          file_name: string | null
          file_path: string | null
          file_url: string | null
          id: string | null
          invoice_date: string | null
          invoice_number: string | null
          linked_payments_count: number | null
          mime_type: string | null
          ocr_error: string | null
          ocr_result: Json | null
          payment_status: string | null
          source: string | null
          status: string | null
          supplier_name: string | null
          supplier_siret: string | null
          tokens_used: number | null
          total_ht: number | null
          total_paid: number | null
          total_ttc: number | null
          tva_amount: number | null
          tva_rate: number | null
          updated_at: string | null
          upload_token_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incoming_invoices_upload_token_id_fkey"
            columns: ["upload_token_id"]
            isOneToOne: false
            referencedRelation: "user_upload_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      count_rti_by_status: {
        Args: never
        Returns: {
          count: number
          status: string
        }[]
      }
      find_similar_products: {
        Args: { p_reference_fabricant: string; p_user_id: string }
        Returns: {
          fournisseur: string
          id: string
          marque: string
          nom: string
          prix_reference: number
          product_group_id: string
        }[]
      }
      find_supplier_template: {
        Args: {
          p_supplier_name: string
          p_supplier_siret?: string
          p_user_id: string
        }
        Returns: string
      }
      generate_order_number: { Args: never; Returns: string }
      generate_upload_token: { Args: never; Returns: string }
      get_latest_rti: {
        Args: { p_project_id: string }
        Returns: {
          created_at: string
          form_data: Json
          id: string
          status: string
        }[]
      }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      increment_download_count: {
        Args: { download_id: string }
        Returns: undefined
      }
      search_documents: {
        Args: {
          filter_source_type?: string
          filter_user_id?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          chunk_index: number
          content: string
          id: string
          page_number: number
          similarity: number
          source_id: string
          source_name: string
          source_type: string
        }[]
      }
      update_template_stats: {
        Args: { p_success?: boolean; p_template_id: string }
        Returns: undefined
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
