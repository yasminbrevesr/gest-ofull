import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { errorMessage, supabase } from '@/lib/supabase'

/** Login com Google é opcional: só aparece com VITE_ENABLE_GOOGLE_LOGIN=true (ver docs/configuracao.md). */
export const googleLoginEnabled = import.meta.env.VITE_ENABLE_GOOGLE_LOGIN === 'true'

export function GoogleButton() {
  const [loading, setLoading] = useState(false)
  if (!googleLoginEnabled) return null

  return (
    <>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={loading}
        onClick={async () => {
          setLoading(true)
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
          })
          if (error) {
            toast.error(errorMessage(error))
            setLoading(false)
          }
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden className="size-4">
          <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8Z" />
          <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23Z" />
          <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10l3.7-2.9Z" />
          <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4Z" />
        </svg>
        Continuar com Google
      </Button>
    </>
  )
}
