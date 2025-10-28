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
          categorie: string | null
          category_id: string | null
          created_at: string
          description: string | null
          fournisseur: string | null
          hauteur_mm: number | null
          id: string
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
          puissance_watts: number | null
          type_electrique: string | null
          url_produit: string | null
          user_id: string
        }
        Insert: {
          categorie?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          fournisseur?: string | null
          hauteur_mm?: number | null
          id?: string
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
          puissance_watts?: number | null
          type_electrique?: string | null
          url_produit?: string | null
          user_id: string
        }
        Update: {
          categorie?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          fournisseur?: string | null
          hauteur_mm?: number | null
          id?: string
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
          puissance_watts?: number | null
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
          project_id: string
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
          project_id: string
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
          project_id?: string
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
      projects: {
        Row: {
          adresse_proprietaire: string | null
          charge_utile_kg: number | null
          created_at: string
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
          charge_utile_kg?: number | null
          created_at?: string
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
          charge_utile_kg?: number | null
          created_at?: string
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
