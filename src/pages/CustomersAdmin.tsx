import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Users, Mail, Phone, MapPin, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import UserMenu from "@/components/UserMenu";
import logo from "@/assets/logo.png";

interface Customer {
  id: string;
  company_name?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  billing_city: string;
  billing_country: string;
  created_at: string;
  _count?: {
    orders: number;
  };
}

const CustomersAdmin = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    filterCustomers();
  }, [searchQuery, customers]);

  const loadCustomers = async () => {
    setLoading(true);

    try {
      // Charger les clients
      const { data: customersData, error: customersError } = await supabase
        .from("shop_customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (customersError) throw customersError;

      // Pour chaque client, compter le nombre de commandes
      const customersWithCount = await Promise.all(
        (customersData || []).map(async (customer) => {
          const { count } = await supabase
            .from("shop_orders")
            .select("*", { count: "exact", head: true })
            .eq("customer_id", customer.id);

          return {
            ...customer,
            _count: {
              orders: count || 0,
            },
          };
        })
      );

      setCustomers(customersWithCount as Customer[]);
    } catch (error) {
      console.error("Erreur lors du chargement des clients:", error);
      toast.error("Erreur lors du chargement des clients");
    } finally {
      setLoading(false);
    }
  };

  const filterCustomers = () => {
    if (!searchQuery) {
      setFilteredCustomers(customers);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = customers.filter(
      (customer) =>
        customer.first_name.toLowerCase().includes(query) ||
        customer.last_name.toLowerCase().includes(query) ||
        customer.email.toLowerCase().includes(query) ||
        customer.company_name?.toLowerCase().includes(query) ||
        customer.phone.includes(query)
    );

    setFilteredCustomers(filtered);
  };

  const getCustomerName = (customer: Customer) => {
    if (customer.company_name) {
      return `${customer.company_name} (${customer.first_name} ${customer.last_name})`;
    }
    return `${customer.first_name} ${customer.last_name}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={logo} alt="Logo" className="h-10" />
              <h1 className="text-xl font-bold">Gestion des Clients</h1>
            </div>
            <UserMenu />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">Chargement des clients...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logo} alt="Logo" className="h-10" />
            <h1 className="text-xl font-bold">Gestion des Clients</h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Clients
                </CardTitle>
                <CardDescription>
                  {customers.length} client{customers.length > 1 ? "s" : ""} enregistré{customers.length > 1 ? "s" : ""}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un client..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? "Aucun client trouvé pour cette recherche" : "Aucun client enregistré"}
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Localisation</TableHead>
                      <TableHead className="text-center">Commandes</TableHead>
                      <TableHead className="text-right">Inscrit le</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <div>
                            <div className="font-semibold">{getCustomerName(customer)}</div>
                            {customer.company_name && (
                              <Badge variant="outline" className="mt-1">
                                Professionnel
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {customer.email}
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {customer.billing_city}, {customer.billing_country}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{customer._count?.orders || 0}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {new Date(customer.created_at).toLocaleDateString("fr-FR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // Rediriger vers les commandes de ce client
                              navigate(`/admin/orders?customer=${customer.id}`);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Commandes
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CustomersAdmin;
