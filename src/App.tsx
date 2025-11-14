import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ProjectDataProvider } from "@/contexts/ProjectDataContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AuthPage from "./components/AuthPage";
import Dashboard from "./pages/Dashboard";
import ProjectDetail from "./pages/ProjectDetail";
import Account from "./pages/Account";
import Admin from "./pages/Admin";
import AccessoriesCatalog from "./pages/AccessoriesCatalog";
import BilanComptablePage from "./pages/BilanComptable";
import ShopAdmin from "./pages/ShopAdmin";
import ShopPublic from "./pages/ShopPublic";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <ProjectDataProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/project/:id" element={<ProjectDetail />} />
              <Route path="/account" element={<Account />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/catalog" element={<AccessoriesCatalog />} />
              <Route path="/bilan-comptable" element={<BilanComptablePage />} />
              <Route path="/shop/admin" element={<ShopAdmin />} />
              <Route path="/shop/public" element={<ShopPublic />} />
              <Route path="/shop" element={<ShopPublic />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ProjectDataProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
