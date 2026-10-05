import React, { useState, useEffect } from 'react';
import { X, ClipboardList } from 'lucide-react';
import api from '../api';
import DocumentViewerModal from './DocumentViewerModal';
import WhatsAppIcon, { getWhatsAppUrl } from './WhatsAppIcon';

const formatDocument = (num) => {
  if (!num) return 'S/D';
  if (/^\d+$/.test(num)) {
    return Number(num).toLocaleString('es-AR');
  }
  return num;
};

const formatPhone = (phone) => {
  if (!phone) return 'Sin teléfono';
  const cleaned = ('' + phone).replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 1)}-${cleaned.slice(1, 5)}-${cleaned.slice(5)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('9')) {
    const part = cleaned.slice(1);
    return `${part.slice(0, 2)}-${part.slice(2, 6)}-${part.slice(6)}`;
  }
  return phone;
};

const PatientDetailModal = ({ isOpen, patient, onClose, onViewDocument, tests, isLoadingTests: externalLoadingTests }) => {
  const [patientData, setPatientData] = useState(patient || null);
  const [internalTests, setInternalTests] = useState([]);
  const [internalLoadingTests, setInternalLoadingTests] = useState(false);
  const [activities, setActivities] = useState([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [viewingDoc, setViewingDoc] = useState(null);

  useEffect(() => {
    if (!isOpen || !patient) {
      setPatientData(null);
      setInternalTests([]);
      setActivities([]);
      setViewingDoc(null);
      return;
    }

    const patId = typeof patient === 'object' ? patient.id : patient;

    if (typeof patient === 'object') {
      setPatientData(patient);
    }

    // If patient object is missing associations or is just an ID, fetch complete patient details
    if (typeof patient !== 'object' || !patient.DocumentType || !patient.PatientDocuments || !patient.Professionals) {
      api.get(`/patients/${patId}`)
        .then(res => setPatientData(res.data))
        .catch(err => console.error('Error fetching patient details:', err));
    }

    // Fetch tests (Lista de pruebas)
    if (!tests || tests.length === 0) {
      setInternalLoadingTests(true);
      api.get(`/patients/${patId}/tests`)
        .then(res => setInternalTests(res.data || []))
        .catch(err => console.error('Error fetching patient tests:', err))
        .finally(() => setInternalLoadingTests(false));
    }

    // Fetch activities (Historia Clínica)
    setIsLoadingActivities(true);
    api.get(`/activities/patient/${patId}`)
      .then(res => setActivities(res.data || []))
      .catch(err => console.error('Error fetching patient activities:', err))
      .finally(() => setIsLoadingActivities(false));
  }, [isOpen, patient, tests]);

  if (!isOpen || !patientData) return null;

  const currentTests = (tests && tests.length > 0) ? tests : internalTests;
  const loadingTests = externalLoadingTests !== undefined ? (externalLoadingTests && currentTests.length === 0) : internalLoadingTests;

  const handleDocClick = (doc) => {
    if (onViewDocument) {
      onViewDocument(doc);
    } else {
      setViewingDoc(doc);
    }
  };

  return (
    <div className="pdm-overlay">
      <style>{`
        .pdm-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.55);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1200;
          backdrop-filter: blur(4px);
          padding: 1.5rem;
          box-sizing: border-box;
        }

        .pdm-container {
          width: 96vw;
          max-width: 1400px;
          height: 92vh;
          max-height: 92vh;
          display: flex;
          flex-direction: column;
          position: relative;
          background-color: #ffffff;
          border-radius: 16px;
          box-shadow: 0 15px 50px rgba(0, 0, 0, 0.22);
          overflow: hidden;
          transform: none !important;
          box-sizing: border-box;
        }

        .pdm-header {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: #ffffff;
          position: sticky;
          top: 0;
          z-index: 10;
          flex-shrink: 0;
        }

        .pdm-body {
          padding: 1.5rem;
          overflow-y: auto;
          flex: 1;
          box-sizing: border-box;
        }

        .pdm-grid {
          display: grid;
          grid-template-columns: minmax(320px, 1fr) minmax(360px, 1.25fr);
          gap: 1.5rem;
          align-items: start;
        }

        .pdm-card {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 1.1rem;
        }

        .pdm-card-title {
          font-size: 1.05rem;
          color: var(--primary, #4f46e5);
          margin-bottom: 0.75rem;
          font-weight: 700;
        }

        .pdm-field-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
        }

        @media (max-width: 960px) {
          .pdm-overlay {
            padding: 0.5rem;
          }
          .pdm-container {
            width: 98vw;
            height: 96vh;
            max-height: 96vh;
            border-radius: 12px;
          }
          .pdm-header {
            padding: 0.85rem 1rem;
          }
          .pdm-body {
            padding: 1rem;
          }
          .pdm-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
          }
          .pdm-field-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="pdm-container">
        {/* Header Fijo */}
        <div className="pdm-header">
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--dark-text)', display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
            <span style={{ flexShrink: 0 }}>Detalle del Paciente:</span>
            <span style={{ color: 'var(--primary)', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {patientData.lastName}, {patientData.firstName}
            </span>
            {patientData.isInactive && (
              <span style={{ fontSize: '0.7rem', backgroundColor: '#fee2e2', color: '#ef4444', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fca5a5', fontWeight: 'bold', flexShrink: 0 }}>
                INACTIVO
              </span>
            )}
          </h2>
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#666', padding: '4px', marginLeft: '12px', flexShrink: 0 }}
            title="Cerrar"
          >
            <X size={22} />
          </button>
        </div>
        
        {/* Contenido scrolleable con Grid Responsivo */}
        <div className="pdm-body">
          <div className="pdm-grid">
            {/* Columna Izquierda: Datos Personales, Dirección, Profesionales, Documentos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Personal info section */}
              <div className="pdm-card">
                <h3 className="pdm-card-title">Datos Personales</h3>
                <div className="pdm-field-grid">
                   <p style={{ margin: 0 }}><strong>Nombre:</strong> {patientData.firstName}</p>
                   <p style={{ margin: 0 }}><strong>Apellido:</strong> {patientData.lastName}</p>
                   <p style={{ margin: 0 }}><strong>Documento:</strong> {formatDocument(patientData.docNumber)} ({patientData.DocumentType?.name || 'S/D'})</p>
                   <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                     <strong>Teléfono:</strong> 
                     <span>{formatPhone(patientData.phone)}</span>
                     {patientData.phone && getWhatsAppUrl(patientData.phone) && (
                       <a 
                         href={getWhatsAppUrl(patientData.phone)} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         style={{ display: 'inline-flex', alignItems: 'center', color: '#25D366' }}
                         title="Abrir WhatsApp Web"
                       >
                         <WhatsAppIcon size={16} />
                       </a>
                     )}
                   </p>
                   <p style={{ margin: 0 }}><strong>Email:</strong> {patientData.email || 'N/A'}</p>
                   <p style={{ margin: 0 }}><strong>Fecha de Nac.:</strong> {patientData.birthDate ? (patientData.birthDate.includes('T') ? patientData.birthDate.split('T')[0] : patientData.birthDate) : 'N/A'}</p>
                   {patientData.isInactive && <p style={{ margin: 0, color: '#ef4444', fontWeight: 'bold', gridColumn: '1 / -1', marginTop: '4px' }}>ESTADO: INACTIVO</p>}
                </div>
              </div>

              {/* Address section */}
              <div className="pdm-card">
                <h3 className="pdm-card-title">Dirección</h3>
                <div className="pdm-field-grid">
                   <p style={{ margin: 0, gridColumn: '1 / -1' }}><strong>Calle y Nro:</strong> {patientData.street || 'N/A'} {patientData.number || ''}</p>
                   <p style={{ margin: 0 }}><strong>Piso:</strong> {patientData.floor || 'N/A'}</p>
                   <p style={{ margin: 0 }}><strong>Depto:</strong> {patientData.apartment || 'N/A'}</p>
                   <p style={{ margin: 0 }}><strong>Ciudad:</strong> {patientData.city || 'N/A'}</p>
                   <p style={{ margin: 0 }}><strong>Provincia:</strong> {patientData.province || 'N/A'}</p>
                   <p style={{ margin: 0 }}><strong>C. Postal:</strong> {patientData.postalCode || 'N/A'}</p>
                </div>
              </div>

              {/* Assigned professionals section */}
              {patientData.Professionals && patientData.Professionals.length > 0 && (
                <div className="pdm-card">
                  <h3 className="pdm-card-title">Profesionales Asignados</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {patientData.Professionals.map(prof => (
                      <span key={prof.id} style={{
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        padding: '4px 12px',
                        borderRadius: '16px',
                        fontSize: '0.85rem',
                        fontWeight: '500',
                        border: '1px solid #bfdbfe'
                      }}>
                        {prof.lastName}, {prof.firstName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents section */}
              <div className="pdm-card">
                <h3 className="pdm-card-title">Documentos</h3>
                <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  {patientData.PatientDocuments && patientData.PatientDocuments.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {patientData.PatientDocuments.map(doc => (
                        <li key={doc.id} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <button 
                            type="button" 
                            onClick={() => handleDocClick(doc)}
                            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--light-blue)', textDecoration: 'none', fontWeight: 'bold', cursor: 'pointer', textAlign: 'left' }}
                            title="Ver o descargar documento"
                          >
                            {doc.originalName}
                          </button>
                          {doc.isConformity && (
                            <span style={{ fontSize: '0.65rem', background: '#0369a1', color: 'white', padding: '1px 6px', borderRadius: '8px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                               C. Conformidad
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ margin: 0, color: '#888', fontStyle: 'italic' }}>No hay documentos cargados.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Columna Derecha: Historia Clínica y Lista de Pruebas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Medical History section */}
              <div className="pdm-card">
                <h3 className="pdm-card-title">Historia Clínica</h3>
                <div style={{ maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
                  {isLoadingActivities ? (
                    <p style={{ margin: 0, color: '#888', fontStyle: 'italic' }}>Cargando historia clínica...</p>
                  ) : activities && activities.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {activities.map(act => (
                        <div key={act.id} style={{ padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.85rem' }}>
                            <strong style={{ color: 'var(--dark-text)' }}>
                              {act.Professional ? `${act.Professional.firstName} ${act.Professional.lastName}` : 'Profesional'}
                            </strong>
                            <span style={{ fontSize: '0.8rem', color: '#888' }}>
                              {new Date(act.date || act.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div style={{ whiteSpace: 'pre-wrap', color: 'var(--dark-text)', fontSize: '0.9rem', lineHeight: '1.45' }}>
                            {act.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, color: '#888', fontStyle: 'italic' }}>No hay notas en la historia clínica.</p>
                  )}
                </div>
              </div>

              {/* Tests section */}
              <div className="pdm-card">
                <h3 className="pdm-card-title">Lista de Pruebas</h3>
                <div style={{ maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
                  {loadingTests ? (
                    <p style={{ margin: 0, color: '#888', fontStyle: 'italic' }}>Cargando pruebas...</p>
                  ) : currentTests && currentTests.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {currentTests.map(pt => (
                        <div key={pt.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                          <ClipboardList size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--primary)' }}>{pt.Test?.name}</div>
                            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '2px' }}>
                              {pt.Test?.category ? `${pt.Test.category} | ` : ''}Fecha: {new Date(pt.date + 'T12:00:00').toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, color: '#888', fontStyle: 'italic' }}>No hay pruebas registradas.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {viewingDoc && (
        <DocumentViewerModal
          doc={viewingDoc}
          onClose={() => setViewingDoc(null)}
          zIndex={1300}
        />
      )}
    </div>
  );
};

export default PatientDetailModal;
