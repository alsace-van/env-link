import React, { useState, useEffect } from 'react';
import { X, FileText, Loader2, Download, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface RTIAutoFillModalProps {
  projectId: string;
  onClose: () => void;
}

interface VehicleData {
  vin?: string;
  marque?: string;
  type?: string;
  immatriculation?: string;
  datePremiereMiseEnCirculation?: string;
  genre?: string;
  carrosserie?: string;
  ptac?: number;
  pv?: number;
}

interface ClientData {
  nom?: string;
  prenom?: string;
  email?: string;
  phone?: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
}

interface Equipement {
  nom: string;
  quantite: number;
  marque?: string;
  reference?: string;
  prix?: number;
}

interface RTIFormData {
  // Annexe 1
  demandeur: ClientData;
  vehicule: VehicleData;
  
  // Annexe 2 - Charges
  charges: {
    ptac: number;
    pv: number;
    chargeUtile: number;
    masseOrdreMarche: number;
    repartitionAvant: number;
    repartitionArriere: number;
  };
  
  // Annexe 3
  transformation: {
    transformateur: string;
    adresseTransformateur: string;
    descriptionTravaux: string;
    equipementsInstalles: Equipement[];
  };
}

export default function RTIAutoFillModal({ projectId, onClose }: RTIAutoFillModalProps) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [formData, setFormData] = useState<RTIFormData | null>(null);
  const [generatedData, setGeneratedData] = useState<any>(null);
  const [step, setStep] = useState<'loading' | 'review' | 'generated'>('loading');

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  const loadProjectData = async () => {
    try {
      setLoading(true);

      // 1. Récupérer les données du projet
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select(`
          *,
          clients (*)
        `)
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;

      // 2. Récupérer les données du véhicule (depuis vehicle_registration)
      const { data: vehicleReg } = await supabase
        .from('vehicle_registration')
        .select('*')
        .eq('project_id', projectId)
        .single();

      // 3. Récupérer les équipements/travaux (depuis expenses)
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*')
        .eq('project_id', projectId)
        .order('date', { ascending: false });

      // 4. Construire les équipements depuis les dépenses
      const equipements: Equipement[] = expenses
        ?.filter(exp => exp.categorie && exp.montant)
        .map(exp => ({
          nom: (exp as any).description || exp.categorie,
          quantite: 1,
          marque: (exp as any).supplier || undefined,
          prix: exp.montant
        })) || [];

      // 5. Pré-remplir le formulaire
      const initialFormData: RTIFormData = {
        demandeur: {
          nom: project.clients?.last_name || '',
          prenom: project.clients?.first_name || '',
          email: project.clients?.email || '',
          phone: project.clients?.phone || '',
          adresse: project.clients?.address || '',
          codePostal: '',
          ville: ''
        },
        vehicule: {
          vin: vehicleReg?.vin || '',
          marque: vehicleReg?.marque || '',
          type: vehicleReg?.modele || '',
          immatriculation: vehicleReg?.immatriculation || '',
          datePremiereMiseEnCirculation: vehicleReg?.date_premiere_immatriculation || '',
          genre: vehicleReg?.genre || 'CTTE',
          carrosserie: vehicleReg?.carrosserie || 'FOURGON',
          ptac: vehicleReg?.ptac ? parseInt(vehicleReg.ptac.toString()) : 0,
          pv: vehicleReg?.poids_vide ? parseInt(vehicleReg.poids_vide.toString()) : 0
        },
        charges: {
          ptac: vehicleReg?.ptac ? parseInt(vehicleReg.ptac.toString()) : 3500,
          pv: vehicleReg?.poids_vide ? parseInt(vehicleReg.poids_vide.toString()) : 2000,
          chargeUtile: 0,
          masseOrdreMarche: 0,
          repartitionAvant: 50,
          repartitionArriere: 50
        },
        transformation: {
          transformateur: 'ALSACE VAN CRÉATION',
          adresseTransformateur: 'Strasbourg, France',
          descriptionTravaux: '',
          equipementsInstalles: equipements
        }
      };

      // Calculer les charges
      initialFormData.charges.chargeUtile = 
        initialFormData.charges.ptac - initialFormData.charges.pv;
      initialFormData.charges.masseOrdreMarche = 
        initialFormData.charges.pv + 75 + 90; // PV + conducteur 75kg + carburant ~90kg

      setFormData(initialFormData);
      setStep('review');
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      alert('Erreur lors du chargement des données du projet');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!formData) return;

    try {
      setGenerating(true);

      // Appeler l'Edge Function Gemini
      const { data, error } = await supabase.functions.invoke('generate-rti', {
        body: {
          projectData: {
            client: formData.demandeur,
            project_id: projectId
          },
          vehicleData: formData.vehicule,
          chargesData: formData.charges,
          equipementsData: formData.transformation.equipementsInstalles
        }
      });

      if (error) throw error;

      setGeneratedData(data.data);
      setStep('generated');
    } catch (error) {
      console.error('Erreur lors de la génération:', error);
      alert('Erreur lors de la génération du document RTI');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadJSON = () => {
    if (!generatedData) return;

    const dataStr = JSON.stringify(generatedData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RTI_${formData?.vehicule.immatriculation || 'projet'}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => {
      if (!prev) return prev;
      const keys = field.split('.');
      const newData = { ...prev };
      let current: any = newData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      
      // Recalculer les charges si nécessaire
      if (field.includes('charges.')) {
        newData.charges.chargeUtile = newData.charges.ptac - newData.charges.pv;
        newData.charges.masseOrdreMarche = newData.charges.pv + 75 + 90;
      }
      
      return newData;
    });
  };

  if (loading || !formData) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
            <p className="text-lg font-medium">Chargement des données du projet...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Remplissage Automatique RTI 03.5.1
              </h2>
              <p className="text-sm text-gray-600">
                Aménagement en autocaravane - VASP
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {step === 'review' && (
            <div className="space-y-6">
              {/* Informations Demandeur */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-4 text-blue-900">
                  📋 Annexe 1 - Demandeur
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nom
                    </label>
                    <input
                      type="text"
                      value={formData.demandeur.nom || ''}
                      onChange={(e) => updateFormData('demandeur.nom', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prénom
                    </label>
                    <input
                      type="text"
                      value={formData.demandeur.prenom || ''}
                      onChange={(e) => updateFormData('demandeur.prenom', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Téléphone
                    </label>
                    <input
                      type="text"
                      value={formData.demandeur.phone || ''}
                      onChange={(e) => updateFormData('demandeur.phone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Informations Véhicule */}
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-4 text-green-900">
                  🚐 Véhicule
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Immatriculation
                    </label>
                    <input
                      type="text"
                      value={formData.vehicule.immatriculation || ''}
                      onChange={(e) => updateFormData('vehicule.immatriculation', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      VIN
                    </label>
                    <input
                      type="text"
                      value={formData.vehicule.vin || ''}
                      onChange={(e) => updateFormData('vehicule.vin', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Marque
                    </label>
                    <input
                      type="text"
                      value={formData.vehicule.marque || ''}
                      onChange={(e) => updateFormData('vehicule.marque', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type/Modèle
                    </label>
                    <input
                      type="text"
                      value={formData.vehicule.type || ''}
                      onChange={(e) => updateFormData('vehicule.type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Charges */}
              <div className="bg-orange-50 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-4 text-orange-900">
                  ⚖️ Annexe 2 - Répartition des charges
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      PTAC (kg)
                    </label>
                    <input
                      type="number"
                      value={formData.charges.ptac}
                      onChange={(e) => updateFormData('charges.ptac', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Poids à vide (kg)
                    </label>
                    <input
                      type="number"
                      value={formData.charges.pv}
                      onChange={(e) => updateFormData('charges.pv', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-orange-200">
                    <p className="text-sm font-medium text-gray-700">Charge utile</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {formData.charges.chargeUtile} kg
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-orange-200">
                    <p className="text-sm font-medium text-gray-700">Masse en ordre de marche</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {formData.charges.masseOrdreMarche} kg
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Répartition avant (%)
                    </label>
                    <input
                      type="number"
                      value={formData.charges.repartitionAvant}
                      onChange={(e) => updateFormData('charges.repartitionAvant', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Répartition arrière (%)
                    </label>
                    <input
                      type="number"
                      value={formData.charges.repartitionArriere}
                      onChange={(e) => updateFormData('charges.repartitionArriere', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              </div>

              {/* Équipements */}
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-4 text-purple-900">
                  🔧 Annexe 3 - Équipements installés
                </h3>
                {formData.transformation.equipementsInstalles.length > 0 ? (
                  <div className="space-y-2">
                    {formData.transformation.equipementsInstalles.map((eq, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{eq.nom}</p>
                          {eq.marque && (
                            <p className="text-sm text-gray-600">Marque: {eq.marque}</p>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">x{eq.quantite}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 italic">
                    Aucun équipement trouvé dans les dépenses du projet.
                    Vous pourrez compléter manuellement après la génération.
                  </p>
                )}
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">
                  ℹ️ <strong>Note :</strong> Gemini AI va générer automatiquement :
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-gray-600">
                  <li>La description détaillée des travaux (Annexe 3)</li>
                  <li>Les calculs de répartition des charges (Annexe 2)</li>
                  <li>Les informations pour la plaque de transformation (Annexe 5)</li>
                </ul>
              </div>
            </div>
          )}

          {step === 'generated' && generatedData && (
            <div className="space-y-6">
              <div className="bg-green-100 border border-green-400 rounded-lg p-4 flex items-start gap-3">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-900">Document RTI généré avec succès !</p>
                  <p className="text-sm text-green-700 mt-1">
                    Toutes les annexes ont été remplies automatiquement par l'IA.
                  </p>
                </div>
              </div>

              {/* Prévisualisation */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-3">📄 Aperçu du document généré</h3>
                <pre className="bg-white p-4 rounded-lg border border-gray-200 text-xs overflow-auto max-h-96">
                  {JSON.stringify(generatedData, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Annuler
          </button>
          
          <div className="flex items-center gap-3">
            {step === 'review' && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Génération en cours...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Générer le document RTI
                  </>
                )}
              </button>
            )}
            
            {step === 'generated' && (
              <button
                onClick={handleDownloadJSON}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                Télécharger JSON
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
