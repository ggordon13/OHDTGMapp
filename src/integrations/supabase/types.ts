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
      challenges: {
        Row: {
          created_at: string
          duration_days: number
          id: string
          leader_id: string
          mode: string
          start_date: string
          status: string
        }
        Insert: {
          created_at?: string
          duration_days?: number
          id?: string
          leader_id: string
          mode: string
          start_date: string
          status?: string
        }
        Update: {
          created_at?: string
          duration_days?: number
          id?: string
          leader_id?: string
          mode?: string
          start_date?: string
          status?: string
        }
        Relationships: []
      }
      challenge_participants: {
        Row: {
          challenge_id: string
          completed_at: string | null
          id: string
          joined_at: string | null
          results_seen_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string | null
          id?: string
          joined_at?: string | null
          results_seen_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string | null
          id?: string
          joined_at?: string | null
          results_seen_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      challenge_rewards: {
        Row: {
          award_key: string
          challenge_id: string
          id: string
          reward_text: string | null
        }
        Insert: {
          award_key: string
          challenge_id: string
          id?: string
          reward_text?: string | null
        }
        Update: {
          award_key?: string
          challenge_id?: string
          id?: string
          reward_text?: string | null
        }
        Relationships: []
      }
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
          access_level: string
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
          email: string | null
          gender: string | null
          goal_type: string
          height_cm: number | null
          id: string
          last_celebrated_weight: number | null
          level: number
          pending_challenge_start_date: string | null
          role: string
          starting_data_updated_at: string | null
          streak_shields: number
          target_weight: number | null
          target_weight_max: number | null
          target_weight_min: number | null
          total_xp: number
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          access_level?: string
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
          email?: string | null
          gender?: string | null
          goal_type?: string
          height_cm?: number | null
          id?: string
          last_celebrated_weight?: number | null
          level?: number
          pending_challenge_start_date?: string | null
          role?: string
          starting_data_updated_at?: string | null
          streak_shields?: number
          target_weight?: number | null
          target_weight_max?: number | null
          target_weight_min?: number | null
          total_xp?: number
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          access_level?: string
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
          email?: string | null
          gender?: string | null
          goal_type?: string
          height_cm?: number | null
          id?: string
          last_celebrated_weight?: number | null
          level?: number
          pending_challenge_start_date?: string | null
          role?: string
          starting_data_updated_at?: string | null
          streak_shields?: number
          target_weight?: number | null
          target_weight_max?: number | null
          target_weight_min?: number | null
          total_xp?: number
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_username_available: {
        Args: { candidate: string }
        Returns: boolean
      }
      is_challenge_member: {
        Args: { p_challenge: string }
        Returns: boolean
      }
      is_challenge_engaged: {
        Args: { p_user: string }
        Returns: boolean
      }
      resolve_challenge_user: {
        Args: { identifier: string }
        Returns: string
      }
      challenge_members: {
        Args: { p_challenge: string }
        Returns: {
          user_id: string
          username: string | null
          status: string
          is_leader: boolean
          joined_at: string | null
        }[]
      }
      challenge_leaderboard: {
        Args: { p_challenge: string }
        Returns: {
          user_id: string
          username: string | null
          xp_window: number
          weight_start: number | null
          weight_end: number | null
          pct_weight_loss: number | null
          avg_steps: number
          exercise_days: number
        }[]
      }
      create_challenge: {
        Args: {
          p_mode: string
          p_start_date: string
          p_participant_ids: string[]
          p_rewards: Json
        }
        Returns: string
      }
      respond_to_challenge: {
        Args: { p_challenge: string; p_accept: boolean }
        Returns: undefined
      }
      cancel_challenge: {
        Args: { p_challenge: string }
        Returns: undefined
      }
      finish_challenge_for_me: {
        Args: { p_challenge: string }
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
