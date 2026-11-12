import { supabase } from './client'
import type { Session, User } from '@supabase/supabase-js'

export interface SignUpCredentials {
  email: string
  password: string
  fullName: string
}

/**
 * Register a new user with Supabase Auth.
 * Note: Only the user's full name is stored in Supabase Auth user_metadata.
 * Recovery PIN, backup phone, devices, and contacts will be managed
 * via dedicated, encrypted database tables in a future phase.
 */
export async function signUp({ email, password, fullName }: SignUpCredentials) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        full_name: fullName.trim(),
      },
    },
  })

  if (error) {
    throw error
  }

  return data
}

/**
 * Authenticate an existing user with email and password.
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  if (error) {
    throw error
  }

  return data
}

/**
 * Sign out the current user session.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    throw error
  }
}

/**
 * Retrieve the current active session.
 */
export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    throw error
  }
  return data.session
}

/**
 * Retrieve the currently authenticated user.
 */
export async function getUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    return null
  }
  return data.user
}

/**
 * Send a Supabase password reset email for account recovery.
 */
export async function sendPasswordReset(email: string, redirectTo?: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim(),
    redirectTo ? { redirectTo } : undefined
  )
  if (error) {
    throw error
  }
}

/**
 * Update the authenticated user's display name in Supabase Auth metadata.
 */
export async function updateAuthFullName(fullName: string) {
  const { error } = await supabase.auth.updateUser({
    data: { full_name: fullName.trim() },
  })
  if (error) {
    throw error
  }
}
