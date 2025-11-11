import React, { useState, useEffect } from 'react';
import { FileText, Download, ExternalLink, Filter, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import RTIAutoFillModal from './RTIAutoFillModal';

interface OfficialDocument {
  id: string;
  name: string;
  description: string;
  category: 'Homologation' | 'Administratif' | 'Technique' | 'Certificat';
  file_url: string;
  version: string;
  is_active: boolean;
  created_at: string;
}

interface OfficialDocumentsManagerProps {
  projectId: string;
}

export function OfficialDocumentsManager({ projectId }: OfficialDocumentsManagerProps) {
  const [documents, setDocuments] = useState<OfficialDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<OfficialDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showRTIModal, setShowRTIModal] = useState(false);

  const categories = ['all', 'Homologation', 'Administratif', 'Technique', 'Certificat'];

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    filterDocuments();
  }, [selectedCategory, documents]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('official_documents')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;

      setDocuments((data || []) as any);
    } catch (err) {
      console.error('Erreur lors du chargement des documents:', err);
      setError('Impossible de charger les documents officiels');
    } finally {
      setLoading(false);
    }
  };

  const filterDocuments = () => {
    if (selectedCategory === 'all') {
      setFilteredDocuments(documents);
    } else {
      setFilteredDocuments(documents.filter(doc => doc.category === selectedCategory));
    }
  };

  const handleOpenDocument = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      Homologation: 'bg-blue-100 text-blue-800 border-blue-200',
      Administratif: 'bg-green-100 text-green-800 border-green-200',
      Technique: 'bg-purple-100 text-purple-800 border-purple-200',
      Certificat: 'bg-orange-100 text-orange-800 border-orange-200',
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Homologation':
        return '🚐';
      case 'Administratif':
        return '📋';
      case 'Technique':
        return '🔧';
      case 'Certificat':
        return '✅';
      default:
        return '📄';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Chargement des documents officiels...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">Erreur</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <button
              onClick={loadDocuments}
              className="mt-3 text-sm text-red-700 underline hover:text-red-900"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec bouton RTI */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Documents Officiels</h2>
          <p className="text-sm text-gray-600 mt-1">
            Formulaires DREAL, CERFA et documents techniques pour l'homologation VASP
          </p>
        </div>

        {/* Bouton Remplissage Auto RTI */}
        <button
          onClick={() => setShowRTIModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md"
        >
          <FileText className="w-5 h-5" />
          <span className="font-medium">Remplissage Auto RTI</span>
        </button>
      </div>

      {/* Filtres par catégorie */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Filter className="w-4 h-4" />
          <span className="font-medium">Filtrer :</span>
        </div>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === category
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {category === 'all' ? 'Tous' : category}
            {category !== 'all' && (
              <span className="ml-2">
                {documents.filter(d => d.category === category).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Liste des documents */}
      {filteredDocuments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Aucun document trouvé</p>
          <p className="text-sm text-gray-500 mt-1">
            {selectedCategory === 'all'
              ? 'Aucun document officiel disponible'
              : `Aucun document dans la catégorie "${selectedCategory}"`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-lg transition-all hover:border-blue-300"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  {/* Icône de catégorie */}
                  <div className="text-4xl">{getCategoryIcon(doc.category)}</div>

                  {/* Informations du document */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {doc.name}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${getCategoryColor(
                          doc.category
                        )}`}
                      >
                        {doc.category}
                      </span>
                      {doc.version && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-mono">
                          v{doc.version}
                        </span>
                      )}
                    </div>

                    {doc.description && (
                      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                        {doc.description.length > 200
                          ? doc.description.substring(0, 200) + '...'
                          : doc.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleOpenDocument(doc.file_url)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                    title="Ouvrir le document"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span className="text-sm font-medium">Ouvrir</span>
                  </button>

                  <a
                    href={doc.file_url}
                    download
                    className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Télécharger le document"
                  >
                    <Download className="w-4 h-4" />
                    <span className="text-sm font-medium">Télécharger</span>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Statistiques */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">
              {filteredDocuments.length} document{filteredDocuments.length > 1 ? 's' : ''} affiché
              {filteredDocuments.length > 1 ? 's' : ''}
            </span>
          </div>
          {selectedCategory !== 'all' && (
            <button
              onClick={() => setSelectedCategory('all')}
              className="text-sm text-blue-700 hover:text-blue-900 underline"
            >
              Voir tous les documents ({documents.length})
            </button>
          )}
        </div>
      </div>

      {/* Info RTI */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-5">
        <div className="flex items-start gap-4">
          <div className="text-3xl">🚐</div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Besoin de remplir un dossier RTI ?
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Le système de <strong>Remplissage Automatique RTI</strong> utilise l'intelligence
              artificielle pour générer automatiquement toutes les annexes du formulaire RTI 03.5.1
              à partir des données de votre projet.
            </p>
            <ul className="text-sm text-gray-700 space-y-1 mb-4">
              <li>✅ Récupération automatique des données client et véhicule</li>
              <li>✅ Calcul des charges (PTAC, poids vide, charge utile)</li>
              <li>✅ Description professionnelle des travaux (300+ mots)</li>
              <li>✅ Liste complète des équipements avec normes</li>
              <li>✅ Export JSON prêt à copier-coller</li>
            </ul>
            <button
              onClick={() => setShowRTIModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <FileText className="w-4 h-4" />
              Générer mon dossier RTI
            </button>
          </div>
        </div>
      </div>

      {/* Modale RTI */}
      {showRTIModal && (
        <RTIAutoFillModal projectId={projectId} onClose={() => setShowRTIModal(false)} />
      )}
    </div>
  );
}
