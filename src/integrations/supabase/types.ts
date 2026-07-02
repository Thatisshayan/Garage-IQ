export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      claim_templates: {
        Row: {
          created_at: string;
          created_by: string | null;
          field_map: Json;
          id: string;
          insurer: string | null;
          name: string;
          notes: string | null;
          storage_path: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          field_map?: Json;
          id?: string;
          insurer?: string | null;
          name: string;
          notes?: string | null;
          storage_path: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          field_map?: Json;
          id?: string;
          insurer?: string | null;
          name?: string;
          notes?: string | null;
          storage_path?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          address: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      document_review_queue: {
        Row: {
          created_at: string;
          details: Json | null;
          document_id: string;
          id: string;
          reason: Database["public"]["Enums"]["review_reason"];
          resolved_at: string | null;
          resolved_by: string | null;
        };
        Insert: {
          created_at?: string;
          details?: Json | null;
          document_id: string;
          id?: string;
          reason: Database["public"]["Enums"]["review_reason"];
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Update: {
          created_at?: string;
          details?: Json | null;
          document_id?: string;
          id?: string;
          reason?: Database["public"]["Enums"]["review_reason"];
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "document_review_queue_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          archived_at: string | null;
          confidence_score: number | null;
          created_at: string;
          customer_id: string | null;
          extracted_data: Json;
          file_name: string;
          id: string;
          is_historical: boolean;
          job_id: string | null;
          mime_type: string | null;
          ocr_text: string | null;
          processing_error: string | null;
          processing_status: Database["public"]["Enums"]["doc_processing_status"];
          size_bytes: number | null;
          storage_path: string;
          type: Database["public"]["Enums"]["doc_type"];
          uploaded_by: string | null;
          vehicle_id: string | null;
        };
        Insert: {
          archived_at?: string | null;
          confidence_score?: number | null;
          created_at?: string;
          customer_id?: string | null;
          extracted_data?: Json;
          file_name: string;
          id?: string;
          is_historical?: boolean;
          job_id?: string | null;
          mime_type?: string | null;
          ocr_text?: string | null;
          processing_error?: string | null;
          processing_status?: Database["public"]["Enums"]["doc_processing_status"];
          size_bytes?: number | null;
          storage_path: string;
          type?: Database["public"]["Enums"]["doc_type"];
          uploaded_by?: string | null;
          vehicle_id?: string | null;
        };
        Update: {
          archived_at?: string | null;
          confidence_score?: number | null;
          created_at?: string;
          customer_id?: string | null;
          extracted_data?: Json;
          file_name?: string;
          id?: string;
          is_historical?: boolean;
          job_id?: string | null;
          mime_type?: string | null;
          ocr_text?: string | null;
          processing_error?: string | null;
          processing_status?: Database["public"]["Enums"]["doc_processing_status"];
          size_bytes?: number | null;
          storage_path?: string;
          type?: Database["public"]["Enums"]["doc_type"];
          uploaded_by?: string | null;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "documents_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      insurance_claims: {
        Row: {
          approved_amount: number | null;
          claim_number: string | null;
          created_at: string;
          effective_date: string | null;
          id: string;
          insurer: string | null;
          job_id: string;
          policy_number: string | null;
          status: Database["public"]["Enums"]["claim_status"];
          updated_at: string;
        };
        Insert: {
          approved_amount?: number | null;
          claim_number?: string | null;
          created_at?: string;
          effective_date?: string | null;
          id?: string;
          insurer?: string | null;
          job_id: string;
          policy_number?: string | null;
          status?: Database["public"]["Enums"]["claim_status"];
          updated_at?: string;
        };
        Update: {
          approved_amount?: number | null;
          claim_number?: string | null;
          created_at?: string;
          effective_date?: string | null;
          id?: string;
          insurer?: string | null;
          job_id?: string;
          policy_number?: string | null;
          status?: Database["public"]["Enums"]["claim_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "insurance_claims_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          amount: number | null;
          created_at: string;
          currency: string | null;
          document_id: string | null;
          due_date: string | null;
          id: string;
          invoice_date: string | null;
          job_id: string | null;
          paid_at: string | null;
          payment_status: Database["public"]["Enums"]["payment_status"];
          tax: number | null;
          total: number | null;
          vendor: string | null;
        };
        Insert: {
          amount?: number | null;
          created_at?: string;
          currency?: string | null;
          document_id?: string | null;
          due_date?: string | null;
          id?: string;
          invoice_date?: string | null;
          job_id?: string | null;
          paid_at?: string | null;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          tax?: number | null;
          total?: number | null;
          vendor?: string | null;
        };
        Update: {
          amount?: number | null;
          created_at?: string;
          currency?: string | null;
          document_id?: string | null;
          due_date?: string | null;
          id?: string;
          invoice_date?: string | null;
          job_id?: string | null;
          paid_at?: string | null;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          tax?: number | null;
          total?: number | null;
          vendor?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      job_status_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          from_status: Database["public"]["Enums"]["job_status"] | null;
          id: string;
          job_id: string;
          reason: string | null;
          source_document_id: string | null;
          to_status: Database["public"]["Enums"]["job_status"];
          trigger: Database["public"]["Enums"]["status_trigger"];
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["job_status"] | null;
          id?: string;
          job_id: string;
          reason?: string | null;
          source_document_id?: string | null;
          to_status: Database["public"]["Enums"]["job_status"];
          trigger: Database["public"]["Enums"]["status_trigger"];
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["job_status"] | null;
          id?: string;
          job_id?: string;
          reason?: string | null;
          source_document_id?: string | null;
          to_status?: Database["public"]["Enums"]["job_status"];
          trigger?: Database["public"]["Enums"]["status_trigger"];
        };
        Relationships: [
          {
            foreignKeyName: "job_status_events_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_status_events_source_document_id_fkey";
            columns: ["source_document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: {
          assigned_to: string | null;
          created_at: string;
          customer_id: string;
          description: string | null;
          flagged: boolean;
          id: string;
          odometer: number | null;
          reported_problem: string | null;
          status: Database["public"]["Enums"]["job_status"];
          total_owed: number | null;
          updated_at: string;
          vehicle_id: string;
        };
        Insert: {
          assigned_to?: string | null;
          created_at?: string;
          customer_id: string;
          description?: string | null;
          flagged?: boolean;
          id?: string;
          odometer?: number | null;
          reported_problem?: string | null;
          status?: Database["public"]["Enums"]["job_status"];
          total_owed?: number | null;
          updated_at?: string;
          vehicle_id: string;
        };
        Update: {
          assigned_to?: string | null;
          created_at?: string;
          customer_id?: string;
          description?: string | null;
          flagged?: boolean;
          id?: string;
          odometer?: number | null;
          reported_problem?: string | null;
          status?: Database["public"]["Enums"]["job_status"];
          total_owed?: number | null;
          updated_at?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string | null;
          currency: string;
          id: string;
          job_id: string;
          method: string | null;
          note: string | null;
          paid_at: string;
          payer_name: string | null;
          payer_type: Database["public"]["Enums"]["payer_type"];
          updated_at: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          job_id: string;
          method?: string | null;
          note?: string | null;
          paid_at?: string;
          payer_name?: string | null;
          payer_type?: Database["public"]["Enums"]["payer_type"];
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          job_id?: string;
          method?: string | null;
          note?: string | null;
          paid_at?: string;
          payer_name?: string | null;
          payer_type?: Database["public"]["Enums"]["payer_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      vehicles: {
        Row: {
          color: string | null;
          created_at: string;
          customer_id: string;
          id: string;
          license_plate: string | null;
          make: string | null;
          model: string | null;
          vin: string | null;
          year: number | null;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          customer_id: string;
          id?: string;
          license_plate?: string | null;
          make?: string | null;
          model?: string | null;
          vin?: string | null;
          year?: number | null;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          customer_id?: string;
          id?: string;
          license_plate?: string | null;
          make?: string | null;
          model?: string | null;
          vin?: string | null;
          year?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "vehicles_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_staff: { Args: { _user_id: string }; Returns: boolean };
    };
    Enums: {
      app_role: "admin" | "staff";
      claim_status: "pending" | "approved" | "denied" | "partial";
      doc_processing_status: "pending" | "processing" | "extracted" | "linked" | "review" | "error";
      doc_type:
        | "invoice"
        | "receipt"
        | "purchase_order"
        | "release_form"
        | "insurance_document"
        | "other"
        | "unclassified";
      job_status:
        | "pending"
        | "awaiting_insurance"
        | "parts_ordered"
        | "in_progress"
        | "awaiting_payment"
        | "completed";
      payer_type: "insurance" | "client" | "other";
      payment_status: "unpaid" | "paid" | "overdue" | "disputed";
      review_reason: "unclassified" | "low_confidence" | "multi_match" | "no_match" | "conflict";
      status_trigger: "event" | "manual" | "ai";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff"],
      claim_status: ["pending", "approved", "denied", "partial"],
      doc_processing_status: ["pending", "processing", "extracted", "linked", "review", "error"],
      doc_type: [
        "invoice",
        "receipt",
        "purchase_order",
        "release_form",
        "insurance_document",
        "other",
        "unclassified",
      ],
      job_status: [
        "pending",
        "awaiting_insurance",
        "parts_ordered",
        "in_progress",
        "awaiting_payment",
        "completed",
      ],
      payer_type: ["insurance", "client", "other"],
      payment_status: ["unpaid", "paid", "overdue", "disputed"],
      review_reason: ["unclassified", "low_confidence", "multi_match", "no_match", "conflict"],
      status_trigger: ["event", "manual", "ai"],
    },
  },
} as const;
