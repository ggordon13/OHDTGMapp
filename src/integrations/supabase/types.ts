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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          achievement_key: string
          created_at: string
          id: string
          tier: string | null
          user_id: string
          xp_awarded: number
        }
        Insert: {
          achievement_key: string
          created_at?: string
          id?: string
          tier?: string | null
          user_id: string
          xp_awarded?: number
        }
        Update: {
          achievement_key?: string
          created_at?: string
          id?: string
          tier?: string | null
          user_id?: string
          xp_awarded?: number
        }
        Relationships: []
      }
      quest_claims: {
        Row: {
          claimed_at: string
          id: string
          period: string
          quest_key: string
          user_id: string
          xp_awarded: number
        }
        Insert: {
          claimed_at?: string
          id?: string
          period: string
          quest_key: string
          user_id: string
          xp_awarded?: number
        }
        Update: {
          claimed_at?: string
          id?: string
          period?: string
          quest_key?: string
          user_id?: string
          xp_awarded?: number
        }
        Relationships: []
      }
      daily_logs: {
        Row: {
          calories: number | null
          created_at: string
          date: string
          day_number: number
          exercise: string | null
          id: string
          protein: number | null
          steps: number | null
          updated_at: string
          user_id: string
          water: number | null
          weight: number | null
        }
        Insert: {
          calories?: number | null
          created_at?: string
          date: string
          day_number: number
          exercise?: string | null
          id?: string
          protein?: number | null
          steps?: number | null
          updated_at?: string
          user_id: string
          water?: number | null
          weight?: number | null
        }
        Update: {
          calories?: number | null
          created_at?: string
          date?: string
          day_number?: number
          exercise?: string | null
          id?: string
          protein?: number | null
          steps?: number | null
          updated_at?: string
          user_id?: string
          water?: number | null
          weight?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_level: string | null
          age: number | null
          avatar_url: string | null
          challenge_start_date: string | null
          created_at: string
          current_weight: number | null
          daily_calorie_target: number | null
          daily_calorie_target_max: number | null
          daily_calorie_target_min: number | null
          daily_protein_target: number | null
          daily_protein_target_max: number | null
          daily_protein_target_min: number | null
          daily_steps_target: number | null
          daily_water_target: number | null
          display_name: string | null
          gender: string | null
          goal_type: string
          height_cm: number | null
          id: string
          last_celebrated_weight: number | null
          level: number
          streak_shields: number
          target_weight: number | null
          target_weight_max: number | null
          target_weight_min: number | null
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_level?: string | null
          age?: number | null
          avatar_url?: string | null
          challenge_start_date?: string | null
          created_at?: string
          current_weight?: number | null
          daily_calorie_target?: number | null
          daily_calorie_target_max?: number | null
          daily_calorie_target_min?: number | null
          daily_protein_target?: number | null
          daily_protein_target_max?: number | null
          daily_protein_target_min?: number | null
          daily_steps_target?: number | null
          daily_water_target?: number | null
          display_name?: string | null
          gender?: string | null
          goal_type?: string
          height_cm?: number | null
          id?: string
          last_celebrated_weight?: number | null
          level?: number
          streak_shields?: number
          target_weight?: number | null
          target_weight_max?: number | null
          target_weight_min?: number | null
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_level?: string | null
          age?: number | null
          avatar_url?: string | null
          challenge_start_date?: string | null
          created_at?: string
          current_weight?: number | null
          daily_calorie_target?: number | null
          daily_calorie_target_max?: number | null
          daily_calorie_target_min?: number | null
          daily_protein_target?: number | null
          daily_protein_target_max?: number | null
          daily_protein_target_min?: number | null
          daily_steps_target?: number | null
          daily_water_target?: number | null
          display_name?: string | null
          gender?: string | null
          goal_type?: string
          height_cm?: number | null
          id?: string
          last_celebrated_weight?: number | null
          level?: number
          streak_shields?: number
          target_weight?: number | null
          target_weight_max?: number | null
          target_weight_min?: number | null
          total_xp?: number
          updated_at?: string
          user_id?: string
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
