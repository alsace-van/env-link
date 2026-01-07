import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ProjectDataProvider } from "@/contexts/ProjectDataContext";
import { CartProvider } from "@/contexts/CartContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AuthPage from "./components/AuthPage";
import Dashboard from "./pages/Dashboard";
import ProjectDetail from "./pages/ProjectDetail";
import Account from "./pages/Account";
import Admin from "./pages/Admin";
import AccessoriesCatalog from "./pages/AccessoriesCatalog";
import ShopPublic from "./pages/ShopPublic";
import ShopAdmin from "./pages/ShopAdmin";
import BilanComptable from "./pages/BilanComptable";
import PhotoTemplates from "./pages/PhotoTemplates";
import PhotoTemplateDetail from "./pages/PhotoTemplateDetail";
import Downloads from "./pages/Downloads";
// Evoliz Integration
import EvolizSettingsPage from "./pages/EvolizSettingsPage";
import EvolizQuotesPage from "./pages/EvolizQuotesPage";
import EvolizClientsPage from "./pages/EvolizClientsPage";
// Tldraw Demo
import TldrawDemo from "./pages/TldrawDemo";
// CAD Gabarit Demo
import CADDemo from "./pages/CADDemo";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <ProjectDataProvider>
        <CartProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/project/:id" element={<ProjectDetail />} />
                <Route path="/project/:id/templates" element={<PhotoTemplates />} />
                <Route path="/project/:id/template/:templateId" element={<PhotoTemplateDetail />} />
                <Route path="/account" element={<Account />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/catalog" element={<AccessoriesCatalog />} />
                <Route path="/bilan-comptable" element={<BilanComptable />} />

                {/* Routes boutique */}
                <Route path="/shop" element={<ShopPublic />} />
                <Route path="/admin/shop" element={<ShopAdmin />} />

                {/* Page outils/téléchargements */}
                <Route path="/downloads" element={<Downloads />} />

                {/* Routes Evoliz */}
                <Route path="/settings/evoliz" element={<EvolizSettingsPage />} />
                <Route path="/evoliz/quotes" element={<EvolizQuotesPage />} />
                <Route path="/evoliz/clients" element={<EvolizClientsPage />} />

                {/* Route démo tldraw */}
                <Route path="/tldraw-demo" element={<TldrawDemo />} />

                {/* Route démo CAD Gabarit */}
                <Route path="/cad-demo" element={<CADDemo />} />

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </CartProvider>
      </ProjectDataProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
