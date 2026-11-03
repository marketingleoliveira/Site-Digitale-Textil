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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_conversations: {
        Row: {
          created_at: string
          handoff_at: string | null
          id: string
          interest_level: string | null
          needs_followup: boolean
          page_url: string | null
          qualification_summary: string | null
          session_id: string
          status: string
          updated_at: string
          user_agent: string | null
          visitor_cnpj: string | null
          visitor_name: string | null
          visitor_whatsapp: string | null
        }
        Insert: {
          created_at?: string
          handoff_at?: string | null
          id?: string
          interest_level?: string | null
          needs_followup?: boolean
          page_url?: string | null
          qualification_summary?: string | null
          session_id: string
          status?: string
          updated_at?: string
          user_agent?: string | null
          visitor_cnpj?: string | null
          visitor_name?: string | null
          visitor_whatsapp?: string | null
        }
        Update: {
          created_at?: string
          handoff_at?: string | null
          id?: string
          interest_level?: string | null
          needs_followup?: boolean
          page_url?: string | null
          qualification_summary?: string | null
          session_id?: string
          status?: string
          updated_at?: string
          user_agent?: string | null
          visitor_cnpj?: string | null
          visitor_name?: string | null
          visitor_whatsapp?: string | null
        }
        Relationships: []
      }
      agent_knowledge: {
        Row: {
          answer: string
          category: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          keywords: string
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          category?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          keywords?: string
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          keywords?: string
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      agent_leads: {
        Row: {
          cnpj: string | null
          conversation_id: string | null
          created_at: string
          email: string | null
          id: string
          interest_level: string
          interest_summary: string | null
          notes: string | null
          page_url: string | null
          segment: string | null
          source: string | null
          status: string
          updated_at: string
          visitor_name: string | null
          whatsapp: string | null
        }
        Insert: {
          cnpj?: string | null
          conversation_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interest_level?: string
          interest_summary?: string | null
          notes?: string | null
          page_url?: string | null
          segment?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          visitor_name?: string | null
          whatsapp?: string | null
        }
        Update: {
          cnpj?: string | null
          conversation_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interest_level?: string
          interest_summary?: string | null
          notes?: string | null
          page_url?: string | null
          segment?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          visitor_name?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_leads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_fallback: boolean
          matched_knowledge_id: string | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_fallback?: boolean
          matched_knowledge_id?: string | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_fallback?: boolean
          matched_knowledge_id?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_settings: {
        Row: {
          agent_name: string
          created_at: string
          fallback_message: string
          greeting: string
          id: string
          is_enabled: boolean
          key: string
          min_typing_delay_ms: number
          persona: string
          qualification_questions: Json
          reply_in_blocks: boolean
          typing_speed_ms: number
          updated_at: string
        }
        Insert: {
          agent_name?: string
          created_at?: string
          fallback_message?: string
          greeting?: string
          id?: string
          is_enabled?: boolean
          key?: string
          min_typing_delay_ms?: number
          persona?: string
          qualification_questions?: Json
          reply_in_blocks?: boolean
          typing_speed_ms?: number
          updated_at?: string
        }
        Update: {
          agent_name?: string
          created_at?: string
          fallback_message?: string
          greeting?: string
          id?: string
          is_enabled?: boolean
          key?: string
          min_typing_delay_ms?: number
          persona?: string
          qualification_questions?: Json
          reply_in_blocks?: boolean
          typing_speed_ms?: number
          updated_at?: string
        }
        Relationships: []
      }
      blog_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_id: string | null
          category_id: string | null
          content: string
          created_at: string
          excerpt: string | null
          featured_image: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          published_at: string | null
          slug: string
          status: string
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          author_id?: string | null
          category_id?: string | null
          content: string
          created_at?: string
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          author_id?: string | null
          category_id?: string | null
          content?: string
          created_at?: string
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      carousel_slides: {
        Row: {
          alt_text: string | null
          created_at: string
          display_order: number
          id: string
          image_url: string
          is_active: boolean
          link_url: string | null
          updated_at: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          is_active?: boolean
          link_url?: string | null
          updated_at?: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          is_active?: boolean
          link_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          replied_at: string | null
          status: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          replied_at?: string | null
          status?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          replied_at?: string | null
          status?: string
        }
        Relationships: []
      }
      crm_lead_deliveries: {
        Row: {
          attempt_count: number
          created_at: string
          delivered_at: string | null
          fabric_lead_id: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          delivered_at?: string | null
          fabric_lead_id: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          delivered_at?: string | null
          fabric_lead_id?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_deliveries_fabric_lead_id_fkey"
            columns: ["fabric_lead_id"]
            isOneToOne: true
            referencedRelation: "fabric_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      fabric_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      fabric_category_assignments: {
        Row: {
          category_id: string
          fabric_id: string
        }
        Insert: {
          category_id: string
          fabric_id: string
        }
        Update: {
          category_id?: string
          fabric_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabric_category_assignments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "fabric_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabric_category_assignments_fabric_id_fkey"
            columns: ["fabric_id"]
            isOneToOne: false
            referencedRelation: "fabrics"
            referencedColumns: ["id"]
          },
        ]
      }
      fabric_leads: {
        Row: {
          cnae: string | null
          cnpj: string
          created_at: string
          email: string
          fabric_id: string | null
          fabric_name: string
          fabric_slug: string
          id: string
          status: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          cnae?: string | null
          cnpj: string
          created_at?: string
          email: string
          fabric_id?: string | null
          fabric_name: string
          fabric_slug: string
          id?: string
          status?: string
          updated_at?: string
          whatsapp: string
        }
        Update: {
          cnae?: string | null
          cnpj?: string
          created_at?: string
          email?: string
          fabric_id?: string | null
          fabric_name?: string
          fabric_slug?: string
          id?: string
          status?: string
          updated_at?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabric_leads_fabric_id_fkey"
            columns: ["fabric_id"]
            isOneToOne: false
            referencedRelation: "fabrics"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrics: {
        Row: {
          applications: string[] | null
          category_id: string | null
          color_variants: Json | null
          created_at: string
          description: string | null
          display_order: number
          features: Json | null
          gallery_images: Json | null
          id: string
          image_url: string | null
          is_active: boolean
          is_featured: boolean
          name: string
          short_description: string | null
          slug: string
          specifications: Json | null
          updated_at: string
        }
        Insert: {
          applications?: string[] | null
          category_id?: string | null
          color_variants?: Json | null
          created_at?: string
          description?: string | null
          display_order?: number
          features?: Json | null
          gallery_images?: Json | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name: string
          short_description?: string | null
          slug: string
          specifications?: Json | null
          updated_at?: string
        }
        Update: {
          applications?: string[] | null
          category_id?: string | null
          color_variants?: Json | null
          created_at?: string
          description?: string | null
          display_order?: number
          features?: Json | null
          gallery_images?: Json | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name?: string
          short_description?: string | null
          slug?: string
          specifications?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabrics_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "fabric_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          created_at: string
          email: string
          id: string
          job_opening_id: string | null
          name: string
          notes: string | null
          resume_url: string
          status: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          job_opening_id?: string | null
          name: string
          notes?: string | null
          resume_url: string
          status?: string
          updated_at?: string
          whatsapp: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          job_opening_id?: string | null
          name?: string
          notes?: string | null
          resume_url?: string
          status?: string
          updated_at?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_opening_id_fkey"
            columns: ["job_opening_id"]
            isOneToOne: false
            referencedRelation: "job_openings"
            referencedColumns: ["id"]
          },
        ]
      }
      job_openings: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          location: string | null
          requirements: string | null
          title: string
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          location?: string | null
          requirements?: string | null
          title: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          location?: string | null
          requirements?: string | null
          title?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lead_validations: {
        Row: {
          ai_summary: string | null
          cnae_match: boolean | null
          cnpj_valid: boolean | null
          company_analysis: string | null
          created_at: string
          email_domain_ok: boolean | null
          fabric_lead_id: string
          id: string
          positive_signals: Json | null
          recommendation: string | null
          risk_signals: Json | null
          score: number
          status: string
          updated_at: string
          validated_at: string | null
          whatsapp_format_ok: boolean | null
        }
        Insert: {
          ai_summary?: string | null
          cnae_match?: boolean | null
          cnpj_valid?: boolean | null
          company_analysis?: string | null
          created_at?: string
          email_domain_ok?: boolean | null
          fabric_lead_id: string
          id?: string
          positive_signals?: Json | null
          recommendation?: string | null
          risk_signals?: Json | null
          score?: number
          status?: string
          updated_at?: string
          validated_at?: string | null
          whatsapp_format_ok?: boolean | null
        }
        Update: {
          ai_summary?: string | null
          cnae_match?: boolean | null
          cnpj_valid?: boolean | null
          company_analysis?: string | null
          created_at?: string
          email_domain_ok?: boolean | null
          fabric_lead_id?: string
          id?: string
          positive_signals?: Json | null
          recommendation?: string | null
          risk_signals?: Json | null
          score?: number
          status?: string
          updated_at?: string
          validated_at?: string | null
          whatsapp_format_ok?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_validations_fabric_lead_id_fkey"
            columns: ["fabric_lead_id"]
            isOneToOne: true
            referencedRelation: "fabric_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          email: string
          id: string
          name: string | null
          source: string | null
          status: string
          subscribed_at: string
          unsubscribed_at: string | null
        }
        Insert: {
          email: string
          id?: string
          name?: string | null
          source?: string | null
          status?: string
          subscribed_at?: string
          unsubscribed_at?: string | null
        }
        Update: {
          email?: string
          id?: string
          name?: string | null
          source?: string | null
          status?: string
          subscribed_at?: string
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      print_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "print_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      prints: {
        Row: {
          category: string | null
          category_id: string | null
          code: string
          created_at: string
          display_order: number
          id: string
          image_url: string
          is_active: boolean
          name: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          category_id?: string | null
          code: string
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          is_active?: boolean
          name?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          category_id?: string | null
          code?: string
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          is_active?: boolean
          name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prints_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "print_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      radar_categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      radar_editions: {
        Row: {
          category_id: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          display_order: number
          edition_date: string
          file_url: string
          happy_count: number
          id: string
          is_published: boolean
          likes: number
          sad_count: number
          slug: string
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          category_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          edition_date?: string
          file_url: string
          happy_count?: number
          id?: string
          is_published?: boolean
          likes?: number
          sad_count?: number
          slug: string
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          category_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          edition_date?: string
          file_url?: string
          happy_count?: number
          id?: string
          is_published?: boolean
          likes?: number
          sad_count?: number
          slug?: string
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "radar_editions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "radar_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_likes: {
        Row: {
          created_at: string
          edition_id: string
          id: string
          ip_address: string
        }
        Insert: {
          created_at?: string
          edition_id: string
          id?: string
          ip_address: string
        }
        Update: {
          created_at?: string
          edition_id?: string
          id?: string
          ip_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "radar_likes_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "radar_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_reactions: {
        Row: {
          created_at: string
          edition_id: string
          id: string
          ip_address: string
          reaction: string
        }
        Insert: {
          created_at?: string
          edition_id: string
          id?: string
          ip_address: string
          reaction: string
        }
        Update: {
          created_at?: string
          edition_id?: string
          id?: string
          ip_address?: string
          reaction?: string
        }
        Relationships: [
          {
            foreignKeyName: "radar_reactions_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "radar_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_topic_suggestions: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string | null
          name: string | null
          page_url: string | null
          status: string
          topic: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          name?: string | null
          page_url?: string | null
          status?: string
          topic: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          name?: string | null
          page_url?: string | null
          status?: string
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      radar_view_log: {
        Row: {
          created_at: string
          edition_id: string | null
          id: string
          increment: number
        }
        Insert: {
          created_at?: string
          edition_id?: string | null
          id?: string
          increment: number
        }
        Update: {
          created_at?: string
          edition_id?: string | null
          id?: string
          increment?: number
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      segments: {
        Row: {
          benefits: Json | null
          created_at: string
          description: string | null
          display_order: number
          fabrics: Json | null
          features: Json | null
          gallery_images: Json | null
          hero_image: string | null
          icon: string
          id: string
          is_active: boolean
          long_description: string | null
          name: string
          slug: string
          subcategories: Json | null
          updated_at: string
        }
        Insert: {
          benefits?: Json | null
          created_at?: string
          description?: string | null
          display_order?: number
          fabrics?: Json | null
          features?: Json | null
          gallery_images?: Json | null
          hero_image?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          long_description?: string | null
          name: string
          slug: string
          subcategories?: Json | null
          updated_at?: string
        }
        Update: {
          benefits?: Json | null
          created_at?: string
          description?: string | null
          display_order?: number
          fabrics?: Json | null
          features?: Json | null
          gallery_images?: Json | null
          hero_image?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          long_description?: string | null
          name?: string
          slug?: string
          subcategories?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      technologies: {
        Row: {
          applications: Json
          benefits: Json
          created_at: string
          description: string | null
          display_order: number
          icon: string | null
          icon_url: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_featured: boolean
          name: string
          short_description: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          applications?: Json
          benefits?: Json
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          icon_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name: string
          short_description?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          applications?: Json
          benefits?: Json
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          icon_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name?: string
          short_description?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          author_company: string | null
          author_name: string
          author_photo_url: string | null
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          quote: string
          rating: number
          updated_at: string
          video_url: string | null
          years_partnership: string | null
        }
        Insert: {
          author_company?: string | null
          author_name: string
          author_photo_url?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          quote: string
          rating?: number
          updated_at?: string
          video_url?: string | null
          years_partnership?: string | null
        }
        Update: {
          author_company?: string | null
          author_name?: string
          author_photo_url?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          quote?: string
          rating?: number
          updated_at?: string
          video_url?: string | null
          years_partnership?: string | null
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
          role?: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_validate_pending_leads: { Args: never; Returns: undefined }
      gen_fake_cnpj: { Args: never; Returns: string }
      gen_textile_cnae: { Args: never; Returns: string }
      generate_fake_fabric_leads: { Args: never; Returns: undefined }
      generate_fake_topic_suggestions: { Args: never; Returns: undefined }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_radar_count: {
        Args: { amount: number; field_name: string; row_id: string }
        Returns: undefined
      }
      increment_radar_counts: {
        Args: { decr_field: string; incr_field: string; row_id: string }
        Returns: undefined
      }
      increment_radar_views_auto: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role:
        | "admin"
        | "editor"
        | "user"
        | "desenvolvedor"
        | "redator"
        | "vendedor"
        | "sdr"
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
      app_role: [
        "admin",
        "editor",
        "user",
        "desenvolvedor",
        "redator",
        "vendedor",
        "sdr",
      ],
    },
  },
} as const
