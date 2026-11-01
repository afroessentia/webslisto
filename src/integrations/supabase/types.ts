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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      lead_events: {
        Row: {
          copy: Database["public"]["Enums"]["copy_t"] | null
          created_at: string
          detail: string | null
          event_type: string
          from_status: Database["public"]["Enums"]["lead_status_t"] | null
          id: string
          lead_id: string
          owner_id: string
          to_status: Database["public"]["Enums"]["lead_status_t"] | null
        }
        Insert: {
          copy?: Database["public"]["Enums"]["copy_t"] | null
          created_at?: string
          detail?: string | null
          event_type: string
          from_status?: Database["public"]["Enums"]["lead_status_t"] | null
          id?: string
          lead_id: string
          owner_id?: string
          to_status?: Database["public"]["Enums"]["lead_status_t"] | null
        }
        Update: {
          copy?: Database["public"]["Enums"]["copy_t"] | null
          created_at?: string
          detail?: string | null
          event_type?: string
          from_status?: Database["public"]["Enums"]["lead_status_t"] | null
          id?: string
          lead_id?: string
          owner_id?: string
          to_status?: Database["public"]["Enums"]["lead_status_t"] | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          dedupe_key: string | null
          first_contacted_at: string | null
          follow_up_date: string | null
          google_place_id: string | null
          google_rating: number | null
          google_reviews_count: number | null
          id: string
          import_batch: string | null
          instagram_handle: string | null
          is_mobile: boolean
          last_contact_date: string | null
          loss_reason: string | null
          name: string
          niche: Database["public"]["Enums"]["lead_niche"]
          no_whatsapp_at: string | null
          notes: string | null
          original_url: string | null
          owner_id: string
          phone: string | null
          proposal_sent_at: string | null
          replied_at: string | null
          reply_type: string | null
          selected_copy: Database["public"]["Enums"]["copy_t"] | null
          source: string
          status: Database["public"]["Enums"]["lead_status_t"]
          subcategory: string | null
          updated_at: string
          website_status: Database["public"]["Enums"]["website_status_t"]
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          dedupe_key?: string | null
          first_contacted_at?: string | null
          follow_up_date?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_reviews_count?: number | null
          id?: string
          import_batch?: string | null
          instagram_handle?: string | null
          is_mobile?: boolean
          last_contact_date?: string | null
          loss_reason?: string | null
          name: string
          niche?: Database["public"]["Enums"]["lead_niche"]
          no_whatsapp_at?: string | null
          notes?: string | null
          original_url?: string | null
          owner_id?: string
          phone?: string | null
          proposal_sent_at?: string | null
          replied_at?: string | null
          reply_type?: string | null
          selected_copy?: Database["public"]["Enums"]["copy_t"] | null
          source?: string
          status?: Database["public"]["Enums"]["lead_status_t"]
          subcategory?: string | null
          updated_at?: string
          website_status?: Database["public"]["Enums"]["website_status_t"]
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          dedupe_key?: string | null
          first_contacted_at?: string | null
          follow_up_date?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_reviews_count?: number | null
          id?: string
          import_batch?: string | null
          instagram_handle?: string | null
          is_mobile?: boolean
          last_contact_date?: string | null
          loss_reason?: string | null
          name?: string
          niche?: Database["public"]["Enums"]["lead_niche"]
          no_whatsapp_at?: string | null
          notes?: string | null
          original_url?: string | null
          owner_id?: string
          phone?: string | null
          proposal_sent_at?: string | null
          replied_at?: string | null
          reply_type?: string | null
          selected_copy?: Database["public"]["Enums"]["copy_t"] | null
          source?: string
          status?: Database["public"]["Enums"]["lead_status_t"]
          subcategory?: string | null
          updated_at?: string
          website_status?: Database["public"]["Enums"]["website_status_t"]
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          body: string
          id: string
          key: Database["public"]["Enums"]["copy_t"]
          owner_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          id?: string
          key: Database["public"]["Enums"]["copy_t"]
          owner_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          id?: string
          key?: Database["public"]["Enums"]["copy_t"]
          owner_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      search_runs: {
        Row: {
          apify_dataset_id: string | null
          apify_run_id: string | null
          city: string
          created_at: string
          duplicates: number
          error: string | null
          finished_at: string | null
          found: number
          id: string
          inserted: number
          max_results: number
          niche: Database["public"]["Enums"]["lead_niche"]
          owner_id: string
          status: string
          subcategory: string
        }
        Insert: {
          apify_dataset_id?: string | null
          apify_run_id?: string | null
          city: string
          created_at?: string
          duplicates?: number
          error?: string | null
          finished_at?: string | null
          found?: number
          id?: string
          inserted?: number
          max_results: number
          niche: Database["public"]["Enums"]["lead_niche"]
          owner_id?: string
          status?: string
          subcategory: string
        }
        Update: {
          apify_dataset_id?: string | null
          apify_run_id?: string | null
          city?: string
          created_at?: string
          duplicates?: number
          error?: string | null
          finished_at?: string | null
          found?: number
          id?: string
          inserted?: number
          max_results?: number
          niche?: Database["public"]["Enums"]["lead_niche"]
          owner_id?: string
          status?: string
          subcategory?: string
        }
        Relationships: []
      }
    }
    Views: {
      lead_metrics: {
        Row: {
          demos_enviadas: number | null
          ganados: number | null
          leads_sin_web: number | null
          total_leads: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      classify_website: {
        Args: { url: string }
        Returns: Database["public"]["Enums"]["website_status_t"]
      }
      ensure_default_templates: { Args: never; Returns: undefined }
      funnel_metrics: {
        Args: {
          p_from: string
          p_niche?: Database["public"]["Enums"]["lead_niche"]
          p_to: string
        }
        Returns: {
          contacted: number
          demos: number
          lost: number
          lost_negocio_cerrado: number
          lost_no_interesa: number
          lost_otro: number
          lost_precio: number
          lost_sin_motivo: number
          lost_solo_ia: number
          lost_ya_tiene_web: number
          proposals: number
          replied: number
          replied_ai: number
          replied_human: number
          won: number
        }[]
      }
      normalize_es_phone: { Args: { raw: string }; Returns: string }
    }
    Enums: {
      copy_t: "demo_gratis" | "oferta_directa_79"
      lead_niche: "reformas" | "belleza_estetica" | "otros"
      lead_status_t:
        | "nuevo"
        | "calificado"
        | "demo_enviada"
        | "en_conversacion"
        | "ganado"
        | "descartado"
        | "no_contactar"
      website_status_t:
        | "sin_web"
        | "solo_redes_sociales"
        | "web_antigua_wordpress"
        | "web_operativa"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      copy_t: ["demo_gratis", "oferta_directa_79"],
      lead_niche: ["reformas", "belleza_estetica", "otros"],
      lead_status_t: [
        "nuevo",
        "calificado",
        "demo_enviada",
        "en_conversacion",
        "ganado",
        "descartado",
        "no_contactar",
      ],
      website_status_t: [
        "sin_web",
        "solo_redes_sociales",
        "web_antigua_wordpress",
        "web_operativa",
      ],
    },
  },
} as const
