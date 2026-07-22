import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import PageNotFound from './lib/PageNotFound';
import Layout from './components/Layout';

const Home = lazy(() => import('./pages/Home'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <Suspense fallback={
          <div className="fixed inset-0 flex items-center justify-center bg-background">
            <div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" />
          </div>
        }>
          <Routes>
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Home />} />
              <Route path="/songs" element={<Home />} />
              <Route path="/services" element={<Home />} />
              <Route path="/mylibrary" element={<Home />} />
              <Route path="/messages" element={<Home />} />
              <Route path="/invite" element={<Home />} />
              <Route path="/musicians" element={<Home />} />
              <Route path="/notifications" element={<Home />} />
              <Route path="/admin" element={<Home />} />
              <Route path="/settings" element={<Home />} />
            </Route>
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Suspense>
      </Router>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App