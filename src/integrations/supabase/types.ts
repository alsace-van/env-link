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
      projects: {
        Row: {
          budget_total: number | null
          carrosserie: string | null
          client_name: string | null
          created_at: string | null
          cylindree: number | null
          date_premiere_immatriculation: string | null
          denomination_commerciale: string | null
          dimension: string | null
          energie: string | null
          genre_national: string | null
          hauteur: number | null
          id: string
          immatriculation: string | null
          largeur: number | null
          longueur: number | null
          marque: string | null
          marque_officielle: string | null
          masse_en_charge_max: number | null
          masse_vide: number | null
          modele: string | null
          modele_officiel: string | null
          nom: string
          nombre_places: number | null
          numero_chassis_vin: string | null
          ptra: number | null
          puissance_fiscale: number | null
          statut: string | null
          user_id: string | null
        }
        Insert: {
          budget_total?: number | null
          carrosserie?: string | null
          client_name?: string | null
          created_at?: string | null
          cylindree?: number | null
          date_premiere_immatriculation?: string | null
          denomination_commerciale?: string | null
          dimension?: string | null
          energie?: string | null
          genre_national?: string | null
          hauteur?: number | null
          id?: string
          immatriculation?: string | null
          largeur?: number | null
          longueur?: number | null
          marque?: string | null
          marque_officielle?: string | null
          masse_en_charge_max?: number | null
          masse_vide?: number | null
          modele?: string | null
          modele_officiel?: string | null
          nom: string
          nombre_places?: number | null
          numero_chassis_vin?: string | null
          ptra?: number | null
          puissance_fiscale?: number | null
          statut?: string | null
          user_id?: string | null
        }
        Update: {
          budget_total?: number | null
          carrosserie?: string | null
          client_name?: string | null
          created_at?: string | null
          cylindree?: number | null
          date_premiere_immatriculation?: string | null
          denomination_commerciale?: string | null
          dimension?: string | null
          energie?: string | null
          genre_national?: string | null
          hauteur?: number | null
          id?: string
          immatriculation?: string | null
          largeur?: number | null
          longueur?: number | null
          marque?: string | null
          marque_officielle?: string | null
          masse_en_charge_max?: number | null
          masse_vide?: number | null
          modele?: string | null
          modele_officiel?: string | null
          nom?: string
          nombre_places?: number | null
          numero_chassis_vin?: string | null
          ptra?: number | null
          puissance_fiscale?: number | null
          statut?: string | null
          user_id?: string | null
        }
        Relationships: []
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
      [_ in never]: never
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
