import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ShopCustomer {
  id: string;
  user_id: string | null;
  has_project_subscription: boolean;
  company_name?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  billing_address: string;
  billing_postal_code: string;
  billing_city: string;
  billing_country: string;
  vat_number?: string;
  shipping_same_as_billing: boolean;
  shipping_recipient_name?: string;
  shipping_address?: string;
  shipping_postal_code?: string;
  shipping_city?: string;
  shipping_country?: string;
}

export const useShopCustomer = (userId: string | undefined) => {
  const [customer, setCustomer] = useState<ShopCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCustomerInfo, setHasCustomerInfo] = useState(false);

  useEffect(() => {
    if (userId) {
      loadCustomer();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const loadCustomer = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("shop_customers")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Erreur lors du chargement des infos client:", error);
        setHasCustomerInfo(false);
      } else if (data) {
        setCustomer(data);
        setHasCustomerInfo(true);
      } else {
        setHasCustomerInfo(false);
      }
    } catch (error) {
      console.error("Erreur:", error);
      setHasCustomerInfo(false);
    } finally {
      setLoading(false);
    }
  };

  const createOrUpdateCustomer = async (data: Partial<ShopCustomer>) => {
    if (!userId) {
      toast.error("Vous devez être connecté");
      return false;
    }

    try {
      const customerData = {
        user_id: userId,
        company_name: data.company_name,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone,
        billing_address: data.billing_address,
        billing_postal_code: data.billing_postal_code,
        billing_city: data.billing_city,
        billing_country: data.billing_country || "France",
        vat_number: data.vat_number,
        shipping_same_as_billing: data.shipping_same_as_billing ?? true,
        shipping_recipient_name: data.shipping_recipient_name,
        shipping_address: data.shipping_address,
        shipping_postal_code: data.shipping_postal_code,
        shipping_city: data.shipping_city,
        shipping_country: data.shipping_country,
      };

      if (customer) {
        // Mise à jour
        const { error } = await supabase
          .from("shop_customers")
          .update(customerData)
          .eq("id", customer.id);

        if (error) throw error;
        toast.success("Informations mises à jour");
      } else {
        // Création
        const { error } = await supabase
          .from("shop_customers")
          .insert(customerData);

        if (error) throw error;
        toast.success("Informations enregistrées");
      }

      await loadCustomer();
      return true;
    } catch (error) {
      console.error("Erreur lors de l'enregistrement:", error);
      toast.error("Erreur lors de l'enregistrement");
      return false;
    }
  };

  return {
    customer,
    loading,
    hasCustomerInfo,
    createOrUpdateCustomer,
    refresh: loadCustomer,
  };
};
