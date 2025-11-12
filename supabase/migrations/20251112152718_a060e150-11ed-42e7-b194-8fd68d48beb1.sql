-- Réactiver les documents officiels avec URLs gouvernementales
-- Note: Ces documents peuvent avoir des limitations CORS, il est recommandé de les uploader dans le système

UPDATE official_documents
SET is_active = true,
    description = 'Formulaire officiel CERFA 13750*07 pour demander un certificat d''immatriculation (carte grise) suite à l''homologation VASP. ⚠️ Pour une meilleure expérience, uploadez ce document via l''interface admin.'
WHERE id = '065a7180-11ca-43df-b4f9-00d8c8da15f6';

UPDATE official_documents
SET is_active = true,
    description = 'Document officiel RTI pour l''aménagement en autocaravane. Guide complet pour la transformation de véhicule. ⚠️ Pour une meilleure expérience, uploadez ce document via l''interface admin.'
WHERE id = '145829fd-5e6b-4c7b-9c0e-b2ce24274183';

-- Les notices AFNOR restent désactivées (liens commerciaux)