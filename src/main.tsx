import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'

import './index.css'

const queryClient = new QueryClient()

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root not found in index.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* Routes are intentionally not defined yet — scaffold only. */}
        <div className="flex min-h-screen items-center justify-center bg-navy text-gold">
          <h1 className="font-sans text-2xl font-semibold">Revploy</h1>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
