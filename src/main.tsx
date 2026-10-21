import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import { App } from './app'
import { supabaseConfigured } from './lib/supabase'
import { AuthProvider } from './providers/auth'
import { ThemeProvider } from './providers/theme'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})

function MissingConfig() {
  return (
    <div className="mx-auto max-w-lg p-8">
      <div role="alert" className="rounded-xl border border-coral bg-coral/25 p-6 text-sm leading-relaxed">
        <p className="mb-2 font-serif text-lg font-semibold">O app está sem a configuração do Supabase</p>
        <p>
          Crie o arquivo <code>.env.local</code> (copie de <code>.env.example</code>) com <code>VITE_SUPABASE_URL</code> e{' '}
          <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> e reinicie o app. Veja <code>docs/configuracao.md</code>.
        </p>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {supabaseConfigured ? (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <App />
            <Toaster
              position="top-center"
              richColors={false}
              closeButton
              toastOptions={{ classNames: { toast: 'font-sans !rounded-lg !border-border !bg-card !text-card-foreground' } }}
            />
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    ) : (
      <MissingConfig />
    )}
  </StrictMode>,
)
