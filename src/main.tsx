import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { PermissionsProvider } from './contexts/PermissionsContext.tsx'
import { ViewingProvider } from './contexts/ViewingContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <PermissionsProvider>
        <ViewingProvider>
          <App />
        </ViewingProvider>
      </PermissionsProvider>
    </AuthProvider>
  </StrictMode>,
)
