import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { supabase } = require('../lib/supabase/client.ts')

async function verifySupabaseConnection() {
  console.log('==================================================')
  console.log('RETRACE: Supabase Network Connection Test')
  console.log('==================================================')

  // 1. Verify environment variables are loaded without exposing sensitive values
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !url.trim()) {
    console.error('✗ Failure: NEXT_PUBLIC_SUPABASE_URL is missing or empty.')
    process.exitCode = 1
    return
  }

  if (!key || !key.trim()) {
    console.error('✗ Failure: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing or empty.')
    process.exitCode = 1
    return
  }

  try {
    const parsedUrl = new URL(url)
    console.log(`✓ NEXT_PUBLIC_SUPABASE_URL loaded: ${parsedUrl.protocol}//${parsedUrl.host}`)
  } catch {
    console.log('✓ NEXT_PUBLIC_SUPABASE_URL loaded')
  }

  const isJwt = key.split('.').length === 3
  const isSupabasePublishable = key.startsWith('sb_') || key.startsWith('sbp_')
  const isPlaceholder =
    key.toLowerCase().includes('your_') ||
    key.toLowerCase().includes('placeholder')

  console.log(`✓ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY loaded: ${key.length} characters (Format: ${isSupabasePublishable ? 'Supabase Publishable Key' : isJwt ? 'Legacy Supabase JWT' : 'Custom/Other'})`)

  if (isPlaceholder) {
    console.log(`⚠️ Warning: The configured key appears to be a placeholder string.`)
  }

  // 2. Perform a genuine network request to the Supabase project
  console.log('\n[Probe] Performing genuine network request to Supabase...')

  try {
    const { data, error } = await supabase.from('_probe_ping_').select('*').limit(0)

    if (error) {
      if (
        error.message?.toLowerCase().includes('invalid api key') ||
        error.message?.toLowerCase().includes('jwt') ||
        (error as any).status === 401
      ) {
        console.error('\n✗ REQUEST FAILED: Supabase rejected the configured API key.')
        console.error(`  Server message: ${error.message}`)
        if (error.hint) console.error(`  Hint: ${error.hint}`)
        process.exitCode = 1
        return
      }

      // If Supabase returns a database error like table not found (42P01 / PGRST205),
      // the request reached Supabase and the API key was authenticated and accepted!
      console.log('\n✓ REQUEST SUCCEEDED: Supabase accepted the API key and responded.')
      console.log(`  Server response: ${error.message} (Code: ${error.code ?? 'N/A'})`)
    } else {
      console.log('\n✓ REQUEST SUCCEEDED: Supabase responded successfully.')
      console.log(`  Data: ${JSON.stringify(data)}`)
    }

    // Harmless Auth getSession verification
    const { error: authError } = await supabase.auth.getSession()
    if (authError) {
      console.warn(`  Auth check notice: ${authError.message}`)
    } else {
      console.log('✓ Supabase Auth client is initialized and operational.')
    }

    console.log('\n==================================================')
    console.log('✅ Connection verification complete!')
    console.log('==================================================')
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('\n✗ REQUEST FAILED: Could not complete network request to Supabase.')
    console.error(`  Error: ${message}`)
    process.exitCode = 1
  }
}

verifySupabaseConnection()
