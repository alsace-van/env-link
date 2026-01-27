// ============================================
// COMPOSANT: ShortcutsPanel
// VERSION: 1.0
// Description: Panneau des raccourcis clavier
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// ============================================

import React from "react";
import { X, MousePointer, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

// ============================================
// TYPES
// ============================================

export interface ShortcutsPanelProps {
  showShortcutsPanel: boolean;
  setShowShortcutsPanel: React.Dispatch<React.SetStateAction<boolean>>;
}

// ============================================
// COMPOSANT
// ============================================

export function ShortcutsPanel({
  showShortcutsPanel,
  setShowShortcutsPanel,
}: ShortcutsPanelProps) {
  if (!showShortcutsPanel) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-blue-500" />
            Raccourcis clavier
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setShowShortcutsPanel(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-2 gap-6">
            {/* Outils */}
            <div>
              <h3 className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1">
                <MousePointer className="h-3.5 w-3.5" /> Outils
              </h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Sélection</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">V</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Déplacer (Pan)</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">H</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Ligne</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">L</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Cercle</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">C</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Arc 3 points</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">A</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Rectangle</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">R</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Mesure</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">M</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Texte</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">T</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Congé</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">F</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Chanfrein</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">K</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Décalage (offset)</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">O</kbd>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div>
              <h3 className="font-semibold text-sm text-gray-700 mb-2">⚡ Actions</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Annuler</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Ctrl+Z</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Refaire</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Ctrl+Y</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Supprimer</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Delete / Backspace</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Échapper outil</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Escape</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Tout sélectionner</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Ctrl+A</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Copier</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Ctrl+C</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Coller</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Ctrl+V</kbd>
                </div>
              </div>
            </div>

            {/* Vue */}
            <div>
              <h3 className="font-semibold text-sm text-gray-700 mb-2">👁️ Vue</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Zoom +</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">+ / Molette ↑</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Zoom -</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">- / Molette ↓</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Recadrer tout</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">0 (zéro)</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Toggle grille</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">G</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Toggle snap</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">S</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Aide raccourcis</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">? / F1</kbd>
                </div>
              </div>
            </div>

            {/* Contraintes */}
            <div>
              <h3 className="font-semibold text-sm text-gray-700 mb-2">📐 Contraintes</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Contrainte horizontale</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Shift (maintenu)</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Contrainte verticale</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Shift (maintenu)</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Multi-sélection</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Ctrl+Clic</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="p-3 border-t bg-gray-50 text-center text-xs text-gray-500">
          Appuyez sur <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">?</kbd> ou{" "}
          <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">F1</kbd> pour afficher ce panneau
        </div>
      </div>
    </div>
  );
}

export default ShortcutsPanel;
