export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type DeviceStatus = 'protected' | 'lost' | 'recovered'
export type RecoveryRequestStatus = 'active' | 'recovered' | 'cancelled'
export type ActivityCategory = 'Device' | 'Security' | 'Recovery'

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
          has_recovery_pin: boolean
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
          has_recovery_pin?: boolean
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
          has_recovery_pin?: boolean
          is_verified?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          id: string
          user_id: string
          name: string
          type: string
          serial_ending: string | null
          status: DeviceStatus
          battery_level: number | null
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
          status?: DeviceStatus
          battery_level?: number | null
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
          status?: DeviceStatus
          battery_level?: number | null
          is_online?: boolean
          last_location_name?: string
          latitude?: number | null
          longitude?: number | null
          last_seen_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'devices_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      trusted_contacts: {
        Row: {
          id: string
          user_id: string
          name: string
          relation: string
          phone: string
          email: string | null
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
          email?: string | null
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
          email?: string | null
          approved?: boolean
          avatar_initials?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'trusted_contacts_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      recovery_requests: {
        Row: {
          id: string
          user_id: string
          device_id: string
          status: RecoveryRequestStatus
          approvals_required: number
          approvals_received: number
          approved_contact_ids: string[]
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          device_id: string
          status?: RecoveryRequestStatus
          approvals_required?: number
          approvals_received?: number
          approved_contact_ids?: string[]
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          device_id?: string
          status?: RecoveryRequestStatus
          approvals_required?: number
          approvals_received?: number
          approved_contact_ids?: string[]
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'recovery_requests_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recovery_requests_device_id_fkey'
            columns: ['device_id']
            isOneToOne: false
            referencedRelation: 'devices'
            referencedColumns: ['id']
          }
        ]
      }
      activity_logs: {
        Row: {
          id: string
          user_id: string
          device_id: string | null
          title: string
          description: string
          category: ActivityCategory
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          device_id?: string | null
          title: string
          description: string
          category: ActivityCategory
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          device_id?: string | null
          title?: string
          description?: string
          category?: ActivityCategory
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'activity_logs_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activity_logs_device_id_fkey'
            columns: ['device_id']
            isOneToOne: false
            referencedRelation: 'devices'
            referencedColumns: ['id']
          }
        ]
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

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Device = Database['public']['Tables']['devices']['Row']
export type TrustedContact = Database['public']['Tables']['trusted_contacts']['Row']
export type RecoveryRequest = Database['public']['Tables']['recovery_requests']['Row']
export type ActivityLog = Database['public']['Tables']['activity_logs']['Row']
