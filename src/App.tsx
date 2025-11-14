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
import Shop from "./pages/Shop";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrdersListPage from "./pages/OrdersListPage";
import OrderDetailsPage from "./pages/OrderDetailsPage";
import ShopAdmin from "./pages/ShopAdmin";
import CustomersAdmin from "./pages/CustomersAdmin";
import OrdersAdmin from "./pages/OrdersAdmin";

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
                <Route path="/account" element={<Account />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/catalog" element={<AccessoriesCatalog />} />
                
                {/* Routes boutique */}
                <Route path="/shop" element={<Shop />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/orders" element={<OrdersListPage />} />
                <Route path="/orders/:orderId" element={<OrderDetailsPage />} />
                
                {/* Routes admin boutique */}
                <Route path="/admin/shop" element={<ShopAdmin />} />
                <Route path="/admin/customers" element={<CustomersAdmin />} />
                <Route path="/admin/orders" element={<OrdersAdmin />} />
                <Route path="/admin/orders/:orderId" element={<OrderDetailsPage />} />
                
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
