/**
 * Hand-curated Database types covering tables the app touches.
 *
 * Source of truth = live Supabase schema (probed via PostgREST). Regenerate
 * fully with the Supabase CLI once SUPABASE_ACCESS_TOKEN is available:
 *
 *   bun run gen:types
 *
 * Until then, this file is the typed contract: any `select("description")`
 * against `restaurants` (which has no `description`) fails at TS compile
 * time instead of silently returning at runtime.
 */
export type Json = string | number | boolean | null | { [k: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string | null;
          phone: string | null;
          full_name: string | null;
          display_name: string | null;
          profile_photo_url: string | null;
          user_type: string | null;
          city: string | null;
          is_verified: boolean | null;
          is_active: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          display_name?: string | null;
          profile_photo_url?: string | null;
          user_type?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
      foodie_profiles: {
        Row: { id: string; user_id: string; created_at: string };
        Insert: { id?: string; user_id: string };
        Update: { id?: string; user_id?: string };
        Relationships: [];
      };
      chef_profiles: {
        Row: {
          id: string;
          user_id: string;
          bio: string | null;
          specialties: string[] | null;
          total_hearts: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { id?: string; user_id: string; bio?: string | null };
        Update: Partial<Database["public"]["Tables"]["chef_profiles"]["Insert"]>;
        Relationships: [];
      };
      restaurants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          cover_image_url: string | null;
          city: string | null;
          address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { id?: string; name: string; slug: string };
        Update: Partial<Database["public"]["Tables"]["restaurants"]["Insert"]>;
        Relationships: [];
      };
      restaurant_tables: {
        Row: {
          id: string;
          restaurant_id: string;
          table_number: string | number | null;
          table_slug: string | null;
          created_at: string;
        };
        Insert: { id?: string; restaurant_id: string; table_number?: string | number | null };
        Update: Partial<Database["public"]["Tables"]["restaurant_tables"]["Insert"]>;
        Relationships: [];
      };
      restaurant_crew: {
        Row: {
          id: string;
          restaurant_id: string;
          chef_profile_id: string;
          crew_role: string;
          is_on_shift: boolean | null;
          joined_at: string;
        };
        Insert: { id?: string; restaurant_id: string; chef_profile_id: string; crew_role: string };
        Update: Partial<Database["public"]["Tables"]["restaurant_crew"]["Insert"]>;
        Relationships: [];
      };
      signature_dishes: {
        Row: {
          id: string;
          chef_profile_id: string;
          restaurant_id: string;
          assigned_crew_id: string | null;
          dish_name: string;
          description: string | null;
          image_url: string | null;
          hearts_count: number | null;
          is_active: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { id?: string; chef_profile_id: string; restaurant_id: string; dish_name: string };
        Update: Partial<Database["public"]["Tables"]["signature_dishes"]["Insert"]>;
        Relationships: [];
      };
      hearts: {
        Row: {
          id: string;
          target_type: string;
          target_id: string;
          anonymous_session_token: string | null;
          from_user_id: string | null;
          is_gps_verified: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          target_type: string;
          target_id: string;
          anonymous_session_token?: string | null;
          from_user_id?: string | null;
          is_gps_verified?: boolean | null;
        };
        Update: Partial<Database["public"]["Tables"]["hearts"]["Insert"]>;
        Relationships: [];
      };
      table_connections: {
        Row: {
          id: string;
          table_id: string;
          anonymous_session_token: string | null;
          entry_method: string | null;
          is_verified_presence: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          table_id: string;
          anonymous_session_token?: string | null;
          entry_method?: string | null;
          is_verified_presence?: boolean | null;
        };
        Update: Partial<Database["public"]["Tables"]["table_connections"]["Insert"]>;
        Relationships: [];
      };
      thank_you_notes: {
        Row: {
          id: string;
          target_chef_id: string;
          note_content: string;
          anonymous_session_token: string | null;
          from_foodie_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          target_chef_id: string;
          note_content: string;
          anonymous_session_token?: string | null;
          from_foodie_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["thank_you_notes"]["Insert"]>;
        Relationships: [];
      };
      meal_visit_proofs: {
        Row: {
          id: string;
          restaurant_id: string;
          table_id: string | null;
          anonymous_session_token: string | null;
          image_url: string;
          foodie_profile_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          table_id?: string | null;
          anonymous_session_token?: string | null;
          image_url: string;
          foodie_profile_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["meal_visit_proofs"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      stitch_anonymous_session: {
        Args: { target_user_id: string; target_foodie_profile_id: string; anon_token: string };
        Returns: unknown;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
