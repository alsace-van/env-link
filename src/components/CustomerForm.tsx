import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAddressAutocomplete } from "@/hooks/useAddressAutocomplete";
import { Loader2, MapPin } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface CustomerFormData {
  companyName?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  billingAddress: string;
  billingPostalCode: string;
  billingCity: string;
  billingCountry: string;
  vatNumber?: string;
  shippingSameAsBilling: boolean;
  shippingRecipientName?: string;
  shippingAddress?: string;
  shippingPostalCode?: string;
  shippingCity?: string;
  shippingCountry?: string;
}

interface CustomerFormProps {
  initialData?: Partial<CustomerFormData>;
  onSubmit: (data: CustomerFormData) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

export const CustomerForm = ({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = "Enregistrer",
}: CustomerFormProps) => {
  const [formData, setFormData] = useState<CustomerFormData>({
    companyName: initialData?.companyName || "",
    firstName: initialData?.firstName || "",
    lastName: initialData?.lastName || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    billingAddress: initialData?.billingAddress || "",
    billingPostalCode: initialData?.billingPostalCode || "",
    billingCity: initialData?.billingCity || "",
    billingCountry: initialData?.billingCountry || "France",
    vatNumber: initialData?.vatNumber || "",
    shippingSameAsBilling: initialData?.shippingSameAsBilling ?? true,
    shippingRecipientName: initialData?.shippingRecipientName || "",
    shippingAddress: initialData?.shippingAddress || "",
    shippingPostalCode: initialData?.shippingPostalCode || "",
    shippingCity: initialData?.shippingCity || "",
    shippingCountry: initialData?.shippingCountry || "France",
  });

  const {
    cities: billingCities,
    loading: billingLoading,
    searchByPostalCode: searchBillingByPostalCode,
    searchByCity: searchBillingByCity,
    reset: resetBillingSearch,
  } = useAddressAutocomplete();

  const {
    cities: shippingCities,
    loading: shippingLoading,
    searchByPostalCode: searchShippingByPostalCode,
    searchByCity: searchShippingByCity,
    reset: resetShippingSearch,
  } = useAddressAutocomplete();

  const [billingPostalOpen, setBillingPostalOpen] = useState(false);
  const [billingCityOpen, setBillingCityOpen] = useState(false);
  const [shippingPostalOpen, setShippingPostalOpen] = useState(false);
  const [shippingCityOpen, setShippingCityOpen] = useState(false);

  // Recherche de ville par code postal (facturation)
  useEffect(() => {
    if (formData.billingPostalCode.length >= 2) {
      searchBillingByPostalCode(formData.billingPostalCode);
    } else {
      resetBillingSearch();
    }
  }, [formData.billingPostalCode]);

  // Recherche de ville (livraison)
  useEffect(() => {
    if (!formData.shippingSameAsBilling && formData.shippingPostalCode && formData.shippingPostalCode.length >= 2) {
      searchShippingByPostalCode(formData.shippingPostalCode);
    } else {
      resetShippingSearch();
    }
  }, [formData.shippingPostalCode, formData.shippingSameAsBilling]);

  const handleChange = (field: keyof CustomerFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleBillingCitySelect = (city: any) => {
    setFormData((prev) => ({
      ...prev,
      billingCity: city.nom,
      billingPostalCode: city.codesPostaux[0] || prev.billingPostalCode,
    }));
    setBillingCityOpen(false);
    setBillingPostalOpen(false);
  };

  const handleShippingCitySelect = (city: any) => {
    setFormData((prev) => ({
      ...prev,
      shippingCity: city.nom,
      shippingPostalCode: city.codesPostaux[0] || prev.shippingPostalCode,
    }));
    setShippingCityOpen(false);
    setShippingPostalOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation simple
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone ||
        !formData.billingAddress || !formData.billingPostalCode || !formData.billingCity) {
      alert("Veuillez remplir tous les champs obligatoires");
      return;
    }

    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Informations générales */}
      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
          <CardDescription>Vos coordonnées pour la facturation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Nom de société (optionnel)</Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => handleChange("companyName", e.target.value)}
                placeholder="Votre société"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vatNumber">N° TVA intracommunautaire (optionnel)</Label>
              <Input
                id="vatNumber"
                value={formData.vatNumber}
                onChange={(e) => handleChange("vatNumber", e.target.value)}
                placeholder="FR12345678901"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom *</Label>
              <Input
                id="firstName"
                required
                value={formData.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                placeholder="Jean"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Nom *</Label>
              <Input
                id="lastName"
                required
                value={formData.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                placeholder="Dupont"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="jean.dupont@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone *</Label>
              <Input
                id="phone"
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="06 12 34 56 78"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Adresse de facturation */}
      <Card>
        <CardHeader>
          <CardTitle>Adresse de facturation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="billingAddress">Adresse *</Label>
            <Input
              id="billingAddress"
              required
              value={formData.billingAddress}
              onChange={(e) => handleChange("billingAddress", e.target.value)}
              placeholder="123 Rue de la République"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="billingPostalCode">Code postal *</Label>
              <Popover open={billingPostalOpen} onOpenChange={setBillingPostalOpen}>
                <PopoverTrigger asChild>
                  <div className="relative">
                    <Input
                      id="billingPostalCode"
                      required
                      value={formData.billingPostalCode}
                      onChange={(e) => {
                        handleChange("billingPostalCode", e.target.value);
                        setBillingPostalOpen(true);
                      }}
                      placeholder="75001"
                    />
                    {billingLoading && (
                      <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </PopoverTrigger>
                {billingCities.length > 0 && (
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandList>
                        <CommandEmpty>Aucune ville trouvée</CommandEmpty>
                        <CommandGroup heading="Villes correspondantes">
                          {billingCities.map((city) => (
                            <CommandItem
                              key={city.code}
                              value={city.nom}
                              onSelect={() => handleBillingCitySelect(city)}
                            >
                              <MapPin className="mr-2 h-4 w-4" />
                              <span>{city.nom} ({city.codesPostaux.join(", ")})</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                )}
              </Popover>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="billingCity">Ville *</Label>
              <Input
                id="billingCity"
                required
                value={formData.billingCity}
                onChange={(e) => {
                  handleChange("billingCity", e.target.value);
                  if (e.target.value.length >= 2) {
                    searchBillingByCity(e.target.value);
                    setBillingCityOpen(true);
                  }
                }}
                placeholder="Paris"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="billingCountry">Pays *</Label>
            <Input
              id="billingCountry"
              required
              value={formData.billingCountry}
              onChange={(e) => handleChange("billingCountry", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Adresse de livraison */}
      <Card>
        <CardHeader>
          <CardTitle>Adresse de livraison</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="shippingSameAsBilling"
              checked={formData.shippingSameAsBilling}
              onCheckedChange={(checked) => handleChange("shippingSameAsBilling", checked)}
            />
            <Label htmlFor="shippingSameAsBilling" className="cursor-pointer">
              Identique à l'adresse de facturation
            </Label>
          </div>

          {!formData.shippingSameAsBilling && (
            <>
              <Separator />
              
              <div className="space-y-2">
                <Label htmlFor="shippingRecipientName">Nom du destinataire (optionnel)</Label>
                <Input
                  id="shippingRecipientName"
                  value={formData.shippingRecipientName}
                  onChange={(e) => handleChange("shippingRecipientName", e.target.value)}
                  placeholder="Si différent du titulaire"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shippingAddress">Adresse *</Label>
                <Input
                  id="shippingAddress"
                  required={!formData.shippingSameAsBilling}
                  value={formData.shippingAddress}
                  onChange={(e) => handleChange("shippingAddress", e.target.value)}
                  placeholder="456 Avenue des Lilas"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shippingPostalCode">Code postal *</Label>
                  <Popover open={shippingPostalOpen} onOpenChange={setShippingPostalOpen}>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <Input
                          id="shippingPostalCode"
                          required={!formData.shippingSameAsBilling}
                          value={formData.shippingPostalCode}
                          onChange={(e) => {
                            handleChange("shippingPostalCode", e.target.value);
                            setShippingPostalOpen(true);
                          }}
                          placeholder="69001"
                        />
                        {shippingLoading && (
                          <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </PopoverTrigger>
                    {shippingCities.length > 0 && (
                      <PopoverContent className="w-[300px] p-0" align="start">
                        <Command>
                          <CommandList>
                            <CommandEmpty>Aucune ville trouvée</CommandEmpty>
                            <CommandGroup heading="Villes correspondantes">
                              {shippingCities.map((city) => (
                                <CommandItem
                                  key={city.code}
                                  value={city.nom}
                                  onSelect={() => handleShippingCitySelect(city)}
                                >
                                  <MapPin className="mr-2 h-4 w-4" />
                                  <span>{city.nom} ({city.codesPostaux.join(", ")})</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    )}
                  </Popover>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="shippingCity">Ville *</Label>
                  <Input
                    id="shippingCity"
                    required={!formData.shippingSameAsBilling}
                    value={formData.shippingCity}
                    onChange={(e) => {
                      handleChange("shippingCity", e.target.value);
                      if (e.target.value.length >= 2) {
                        searchShippingByCity(e.target.value);
                        setShippingCityOpen(true);
                      }
                    }}
                    placeholder="Lyon"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shippingCountry">Pays *</Label>
                <Input
                  id="shippingCountry"
                  required={!formData.shippingSameAsBilling}
                  value={formData.shippingCountry}
                  onChange={(e) => handleChange("shippingCountry", e.target.value)}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Boutons */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
        )}
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
};
