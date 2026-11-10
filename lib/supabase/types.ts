export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          recovery_id: string
          backup_phone: string | null
          recovery_pin_hash: string | null
          is_verified: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          recovery_id: string
          backup_phone?: string | null
          recovery_pin_hash?: string | null
          is_verified?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          recovery_id?: string
          backup_phone?: string | null
          recovery_pin_hash?: string | null
          is_verified?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      devices: {
        Row: {
          id: string
          user_id: string
          name: string
          type: string
          serial_ending: string | null
          status: 'protected' | 'lost' | 'recovered'
          battery_level: number
          is_online: boolean
          last_location_name: string
          latitude: number | null
          longitude: number | null
          last_seen_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: string
          serial_ending?: string | null
          status?: 'protected' | 'lost' | 'recovered'
          battery_level?: number
          is_online?: boolean
          last_location_name?: string
          latitude?: number | null
          longitude?: number | null
          last_seen_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: string
          serial_ending?: string | null
          status?: 'protected' | 'lost' | 'recovered'
          battery_level?: number
          is_online?: boolean
          last_location_name?: string
          latitude?: number | null
          longitude?: number | null
          last_seen_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      trusted_contacts: {
        Row: {
          id: string
          user_id: string
          name: string
          relation: string
          phone: string
          approved: boolean
          avatar_initials: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          relation: string
          phone: string
          approved?: boolean
          avatar_initials: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          relation?: string
          phone?: string
          approved?: boolean
          avatar_initials?: string
          created_at?: string
          updated_at?: string
        }
      }
      recovery_requests: {
        Row: {
          id: string
          user_id: string
          device_id: string
          status: 'active' | 'recovered' | 'cancelled'
          approvals_required: number
          approvals_received: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          device_id: string
          status?: 'active' | 'recovered' | 'cancelled'
          approvals_required?: number
          approvals_received?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          device_id?: string
          status?: 'active' | 'recovered' | 'cancelled'
          approvals_required?: number
          approvals_received?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      activity_logs: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string
          category: 'Device' | 'Security' | 'Recovery'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description: string
          category: 'Device' | 'Security' | 'Recovery'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string
          category?: 'Device' | 'Security' | 'Recovery'
          created_at?: string
        }
      }
    }
  }
}

