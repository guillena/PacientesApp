import React, { useState, useEffect } from 'react';
import api from '../api';
import { Search, UserPlus, Edit3, X, ArrowUpDown, ArrowUp, ArrowDown, Activity, List, Grid, Eye, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCw, FileText, Trash2, Calendar, CheckCircle2, MoreVertical, ClipboardList, Upload, Mic, MicOff, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import MessageModal from '../components/MessageModal';
import { useAuth } from '../store/AuthContext';

const provinces = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 
  'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 
  'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
];

// Helper functions for formatting
const formatDocument = (num) => {
  if (!num) return 'S/D';
  // Check if it's numeric only for thousands separator
  if (/^\d+$/.test(num)) {
    return Number(num).toLocaleString('es-AR');
  }
  return num;
};

const formatPhone = (phone) => {
  if (!phone) return 'Sin teléfono';
  // Remove non-digit characters
  const cleaned = ('' + phone).replace(/\D/g, '');
  
  // Format based on length
  // 10 digits: standard 2-digit area code (XX-XXXX-XXXX)
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  
  // 9 digits: case where there's only 1-digit area code (X-XXXX-XXXX)
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 1)}-${cleaned.slice(1, 5)}-${cleaned.slice(5)}`;
  }
  
  // If it has 11 digits (with extra 9 for mobile), take last 10
  if (cleaned.length === 11 && cleaned.startsWith('9')) {
    const part = cleaned.slice(1);
    return `${part.slice(0, 2)}-${part.slice(2, 6)}-${part.slice(6)}`;
  }

  // If it has country code (e.g. 54 11 ...), take last 10
  if (cleaned.length >= 10) {
    const last10 = cleaned.slice(-10);
    return `${last10.slice(0, 2)}-${last10.slice(2, 6)}-${last10.slice(6)}`;
  }

  return phone;
};

const Patients = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [docTypes, setDocTypes] = useState([]);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    docNumber: '',
    email: '',
    phone: '',
    birthDate: '',
    street: '',
    number: '',
    floor: '',
    apartment: '',
    province: '',
    city: '',
    postalCode: '',
    docTypeId: '',
    isInactive: false
  });
  const [editingId, setEditingId] = useState(null);
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'card'
  const [sortConfig, setSortConfig] = useState({ key: 'firstName', direction: 'asc' });
  
  // State for Activities
  const [showActivitiesModal, setShowActivitiesModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [activities, setActivities] = useState([]);
  const [newActivityDesc, setNewActivityDesc] = useState('');
  const [editingActivityId, setEditingActivityId] = useState(null);
  const [editingActivityDesc, setEditingActivityDesc] = useState('');
  
  // State for Sessions (Appointments)
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [patientSessions, setPatientSessions] = useState([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  
  // Tabs and Documents state
  const [activeTab, setActiveTab] = useState('personal');
  const [patientDocs, setPatientDocs] = useState([]);
  const getLocalDate = () => new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

  // Tests state
  const [patientTests, setPatientTests] = useState([]);
  const [availableTests, setAvailableTests] = useState([]);
  const [newTest, setNewTest] = useState({ testId: '', date: getLocalDate() });
  const [isLoadingTests, setIsLoadingTests] = useState(false);
  const [testSearchQuery, setTestSearchQuery] = useState('');

  // View Patient state
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingPatient, setViewingPatient] = useState(null);

  // Document Viewer state
  const [showingDoc, setShowingDoc] = useState(null);
  const [isDocMaximized, setIsDocMaximized] = useState(false);
  const [imgZoom, setImgZoom] = useState(1);
  const [imgRotation, setImgRotation] = useState(0);
  const [isConformityChecked, setIsConformityChecked] = useState(false);
  const [docUploadFile, setDocUploadFile] = useState(null);

  // QR Photo Upload state (patient)
  const [showPatientQrModal, setShowPatientQrModal] = useState(false);
  const [patientQrUrl, setPatientQrUrl] = useState('');
  const [patientQrLoading, setPatientQrLoading] = useState(false);

  const handleOpenPatientQr = async () => {
    if (!editingId) return;
    setPatientQrLoading(true);
    setPatientQrUrl('');
    setShowPatientQrModal(true);
    try {
      const res = await api.post(`/patients/${editingId}/photo-token`);
      setPatientQrUrl(res.data.url);
    } catch (e) {
      setShowPatientQrModal(false);
      showMsg('Error al generar el QR: ' + (e.response?.data?.error || e.message), 'alert');
    } finally {
      setPatientQrLoading(false);
    }
  };

  // State for Global Messages
  const [msgModal, setMsgModal] = useState({ isOpen: false, message: '', type: 'info', onConfirm: null });

  const [activeDropdown, setActiveDropdown] = useState(null);

  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const showMsg = (message, type = 'info', onConfirm = null) => {
    setMsgModal({ isOpen: true, message, type, onConfirm });
  };

  // Speech Recognition / Voice Dictation (es-AR)
  const [isListening, setIsListening] = useState(false);
  const [listeningField, setListeningField] = useState(null);
  const recognitionRef = React.useRef(null);

  const stopDictation = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
    setListeningField(null);
  };

  const toggleDictation = (setTargetState, fieldId) => {
    if (isListening && listeningField === fieldId) {
      stopDictation();
      return;
    }

    stopDictation();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showMsg('Tu navegador no soporta el dictado por voz nativo. Te recomendamos utilizar Google Chrome, Microsoft Edge o Safari.', 'alert');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'es-AR'; // Castellano Argentino

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript;
          }
        }
        if (transcript) {
          setTargetState(prev => {
            const space = prev && !prev.endsWith(' ') ? ' ' : '';
            return prev + space + transcript.trim();
          });
        }
      };

      recognition.onerror = (event) => {
        console.error('Error en reconocimiento de voz:', event.error);
        if (event.error === 'not-allowed') {
          showMsg('Permiso de micrófono denegado. Por favor habilita el permiso de micrófono en la barra de tu navegador.', 'alert');
        }
        stopDictation();
      };

      recognition.onend = () => {
        setIsListening(false);
        setListeningField(null);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
      setListeningField(fieldId);
    } catch (err) {
      console.error('No se pudo iniciar el dictado por voz:', err);
      stopDictation();
    }
  };

  useEffect(() => {
    fetchPatients();
    fetchDocTypes();
    fetchAvailableTests();
  }, []);

  const fetchAvailableTests = async () => {
    try {
      const response = await api.get('/tests');
      setAvailableTests(response.data.filter(t => t.active));
    } catch (err) {
      console.error('Error fetching tests', err);
    }
  };

  const fetchPatients = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/patients');
      setPatients(response.data);
    } catch (err) {
      console.error('Error fetching patients', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDocTypes = async () => {
    try {
      const response = await api.get('/patients/document-types');
      setDocTypes(response.data);
      if (response.data.length > 0) {
        setFormData(prev => ({ ...prev, docTypeId: response.data[0].id }));
      }
    } catch (err) {
      console.error('Error fetching doc types', err);
    }
  };

  const fetchPatientTests = async (id) => {
    setIsLoadingTests(true);
    try {
      const response = await api.get(`/patients/${id}/tests`);
      setPatientTests(response.data);
    } catch (err) {
      console.error('Error fetching patient tests', err);
    } finally {
      setIsLoadingTests(false);
    }
  };

  const handleAddTest = async () => {
    try {
      const response = await api.post(`/patients/${editingId}/tests`, newTest);
      setPatientTests([response.data, ...patientTests].sort((a, b) => new Date(b.date) - new Date(a.date)));
      setNewTest({ testId: '', date: getLocalDate() });
    } catch (err) {
      showMsg('Error al agregar la prueba', 'alert');
    }
  };

  const handleDeleteTest = (testId) => {
    showMsg('¿Está seguro de que desea eliminar esta prueba?', 'alert', async () => {
      try {
        await api.delete(`/patients/${editingId}/tests/${testId}`);
        setPatientTests(patientTests.filter(pt => pt.id !== testId));
      } catch (err) {
        showMsg('Error al eliminar la prueba', 'alert');
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Manual Validation to prevent "not focusable" error on hidden tabs
    if (!formData.lastName.trim() || !formData.firstName.trim() || !formData.docNumber.trim() || !formData.phone.trim() || !formData.docTypeId) {
      setActiveTab('personal');
      showMsg('Por favor complete todos los campos obligatorios (*).', 'alert');
      return;
    }

    try {
      if (editingId) {
        await api.patch(`/patients/${editingId}`, formData);
      } else {
        await api.post('/patients', formData);
      }
      setShowModal(false);
      setEditingId(null);
      setFormData({
        firstName: '', lastName: '', docNumber: '', email: '', phone: '', birthDate: '', street: '', number: '', floor: '', apartment: '', province: '', city: '', postalCode: '', docTypeId: '', isInactive: false
      });
      fetchPatients();
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al guardar el paciente. Verifique los datos.';
      showMsg(msg, 'alert');
    }
  };

  const handleEdit = (patient) => {
    setFormData({
      firstName: patient.firstName,
      lastName: patient.lastName,
      docNumber: patient.docNumber,
      email: patient.email || '',
      phone: patient.phone || '',
      birthDate: patient.birthDate ? patient.birthDate.split('T')[0] : '',
      street: patient.street || '',
      number: patient.number || '',
      floor: patient.floor || '',
      apartment: patient.apartment || '',
      province: patient.province || '',
      city: patient.city || '',
      postalCode: patient.postalCode || '',
      docTypeId: patient.docTypeId || (docTypes.length > 0 ? docTypes[0].id : ''),
      isInactive: patient.isInactive || false
    });
    setPatientDocs(patient.PatientDocuments || []);
    setEditingId(patient.id);
    setActiveTab('personal');
    fetchPatientTests(patient.id);
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingId(null);
    setPatientDocs([]);
    setPatientTests([]);
    setFormData({
      firstName: '', lastName: '', docNumber: '', email: '', phone: '', birthDate: '', street: '', number: '', floor: '', apartment: '', province: '', city: '', postalCode: '',
      docTypeId: docTypes.length > 0 ? docTypes[0].id : '',
      isInactive: false
    });
    setActiveTab('personal');
    setShowModal(true);
  };

  const openViewModal = (patient) => {
    setViewingPatient(patient);
    setPatientTests([]); // Clear previous
    fetchPatientTests(patient.id);
    setShowViewModal(true);
  };

  const handleDeletePatient = async (id) => {
    showMsg(
      '¿Está seguro de que desea eliminar permanentemente a este paciente? Se borrará TODO su historial y todos los archivos adjuntos.', 
      'info', 
      async () => {
        setIsLoading(true);
        try {
          await api.delete(`/patients/${id}`);
          await fetchPatients();
        } catch (err) {
          showMsg('Error al eliminar el paciente. No tiene permisos suficientes o ocurrió un error en el servidor.', 'alert');
        } finally {
          setIsLoading(false);
        }
      }
    );
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!docUploadFile || !editingId) return;

    const files = Array.from(docUploadFile);
    if (files.length === 0) return;

    const uploadFile = async (file) => {
      const data = new FormData();
      data.append('file', file);
      data.append('isConformity', isConformityChecked);
      try {
        const response = await api.post(`/patients/${editingId}/documents`, data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
      } catch (err) {
        console.error('Error uploading file:', file.name, err);
        throw err;
      }
    };

    try {
      const results = await Promise.all(files.map(file => uploadFile(file)));
      setPatientDocs([...patientDocs, ...results]);
      fetchPatients();
    } catch (err) {
      showMsg('Hubo un error al subir uno o más documentos', 'alert');
    } finally {
      setDocUploadFile(null);
      setIsConformityChecked(false);
      const fileInput = document.getElementById('patient-file-upload');
      if (fileInput) fileInput.value = '';
    }
  };

  const handleDeleteDoc = (docId) => {
    showMsg('¿Está seguro de que desea eliminar este documento?', 'alert', async () => {
      try {
        await api.delete(`/patients/${editingId}/documents/${docId}`);
        setPatientDocs(patientDocs.filter(d => d.id !== docId));
        fetchPatients();
      } catch (err) {
        showMsg('Error al eliminar el documento', 'alert');
      }
    });
  };

  const handleDownload = async (doc) => {
    const fullUrl = doc.url.startsWith('http') ? doc.url : `http://localhost:5000${doc.url}`;
    try {
      const response = await fetch(fullUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.originalName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading file:', err);
      // Fallback to direct link if fetch fails (e.g. CORS)
      const link = document.createElement('a');
      link.href = fullUrl;
      link.setAttribute('download', doc.originalName);
      link.setAttribute('target', '_blank');
      link.click();
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedPatients = React.useMemo(() => {
    let sortableItems = [...patients];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue, bValue;
        if (sortConfig.key === 'firstName') {
          aValue = `${a.lastName || ''}, ${a.firstName || ''}`;
          bValue = `${b.lastName || ''}, ${b.firstName || ''}`;
        } else if (sortConfig.key === 'phone') {
          aValue = (a.phone || '').toString();
          bValue = (b.phone || '').toString();
        } else if (sortConfig.key === 'docNumber') {
          aValue = (a.docNumber || '').toString();
          bValue = (b.docNumber || '').toString();
        } else {
          aValue = (a[sortConfig.key] || '').toString();
          bValue = (b[sortConfig.key] || '').toString();
        }

        const cmp = aValue.localeCompare(bValue, 'es-AR', { sensitivity: 'base' });
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      });
    }
    return sortableItems;
  }, [patients, sortConfig]);

  const filteredPatients = sortedPatients.filter(p => {
    if (showOnlyActive && p.isInactive) return false;
    return `${p.lastName}, ${p.firstName} ${p.docNumber}`.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getSortIcon = (columnName) => {
    if (sortConfig.key === columnName) {
      return sortConfig.direction === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />;
    }
    return <ArrowUpDown size={16} style={{ opacity: 0.3 }} />;
  };

  const openActivities = async (patient) => {
    setSelectedPatient(patient);
    try {
      const response = await api.get(`/activities/patient/${patient.id}`);
      setActivities(response.data);
      setShowActivitiesModal(true);
    } catch (err) {
      showMsg('Error al cargar actividades.', 'alert');
    }
  };

  const handleAddActivity = async (e) => {
    e.preventDefault();
    if (!newActivityDesc.trim()) return;
    try {
      const response = await api.post('/activities', {
        patientId: selectedPatient.id,
        description: newActivityDesc
      });
      setActivities([response.data, ...activities]);
      setNewActivityDesc('');
    } catch (err) {
      showMsg('Error al agregar actividad.', 'alert');
    }
  };

  const startEditActivity = (act) => {
    setEditingActivityId(act.id);
    setEditingActivityDesc(act.description);
  };

  const handleUpdateActivity = async (id) => {
    if (!editingActivityDesc.trim()) return;
    try {
      const response = await api.patch(`/activities/${id}`, {
        description: editingActivityDesc
      });
      setActivities(activities.map(act => act.id === id ? response.data : act));
      setEditingActivityId(null);
      setEditingActivityDesc('');
    } catch (err) {
      showMsg('Error al actualizar actividad.', 'alert');
    }
  };

  const handleDeleteActivity = (id) => {
    showMsg('¿Está seguro de que desea eliminar esta nota?', 'alert', async () => {
      try {
        await api.delete(`/activities/${id}`);
        setActivities(activities.filter(act => act.id !== id));
      } catch (err) {
        showMsg('Error al eliminar actividad.', 'alert');
      }
    });
  };

  const openSessions = async (patient) => {
    setSelectedPatient(patient);
    setIsLoadingSessions(true);
    try {
      const response = await api.get(`/appointments/patient/${patient.id}`);
      setPatientSessions(response.data);
      setShowSessionsModal(true);
    } catch (err) {
      showMsg('Error al cargar las sesiones.', 'alert');
    } finally {
      setIsLoadingSessions(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Gestión de Pacientes</h1>
        <button 
          className="btn btn-primary" 
          onClick={openCreateModal}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <UserPlus size={20} />
          Nuevo Paciente
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button 
              onClick={() => setShowModal(false)}
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingId ? 'Editar Paciente' : 'Nuevo Paciente'}</h2>
            
            {/* Tabs Navigation */}
            <div style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: '1.5rem', gap: '20px' }}>
              <button 
                type="button"
                onClick={() => setActiveTab('personal')}
                style={{ background: 'none', border: 'none', padding: '10px 5px', cursor: 'pointer', borderBottom: activeTab === 'personal' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: activeTab === 'personal' ? 'bold' : 'normal', color: activeTab === 'personal' ? 'var(--primary)' : '#666' }}
              >
                Datos Personales
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('direction')}
                style={{ background: 'none', border: 'none', padding: '10px 5px', cursor: 'pointer', borderBottom: activeTab === 'direction' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: activeTab === 'direction' ? 'bold' : 'normal', color: activeTab === 'direction' ? 'var(--primary)' : '#666' }}
              >
                Dirección
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('documents')}
                style={{ background: 'none', border: 'none', padding: '10px 5px', cursor: 'pointer', borderBottom: activeTab === 'documents' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: activeTab === 'documents' ? 'bold' : 'normal', color: activeTab === 'documents' ? 'var(--primary)' : '#666' }}
              >
                Documentos
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('tests')}
                style={{ background: 'none', border: 'none', padding: '10px 5px', cursor: 'pointer', borderBottom: activeTab === 'tests' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: activeTab === 'tests' ? 'bold' : 'normal', color: activeTab === 'tests' ? 'var(--primary)' : '#666' }}
              >
                Pruebas
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div style={{ display: activeTab === 'personal' ? 'block' : 'none' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                     <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '4px' }}>Primer Apellido *</label>
                    <input type="text" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '4px' }}>Nombre *</label>
                    <input type="text" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '4px' }}>Tipo Doc *</label>
                    <select style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: 'white' }} value={formData.docTypeId} onChange={e => setFormData({...formData, docTypeId: e.target.value})}>
                      <option value="" disabled>Seleccione...</option>
                      {docTypes && docTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '4px' }}>Nro. de Documento *</label>
                    <input 
                      type="text" 
                      placeholder="Ej: 12.345.678" 
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} 
                      value={formData.docNumber} 
                      onChange={e => setFormData({...formData, docNumber: e.target.value})} 
                      onBlur={e => setFormData({...formData, docNumber: formatDocument(e.target.value.replace(/\D/g, ''))})}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '4px' }}>Email</label>
                  <input type="email" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '4px' }}>Teléfono *</label>
                    <input 
                      type="text" 
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} 
                      value={formData.phone} 
                      onChange={e => setFormData({...formData, phone: e.target.value})} 
                      onBlur={e => setFormData({...formData, phone: formatPhone(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '4px' }}>Fecha de Nac.</label>
                    <input type="date" max={getLocalDate()} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} value={formData.birthDate || ''} onChange={e => setFormData({...formData, birthDate: e.target.value})} />
                  </div>
                </div>
                <div style={{ marginBottom: '2rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer', backgroundColor: '#fdfdfd', padding: '10px', borderRadius: '8px', border: '1px solid #eee' }}>
                    <input type="checkbox" checked={formData.isInactive} onChange={e => setFormData({...formData, isInactive: e.target.checked})} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                    <span>Deshabilitar Paciente (Inactivo)</span>
                  </label>
                </div>
              </div>

              <div style={{ display: activeTab === 'direction' ? 'block' : 'none' }}>
                <div style={{ marginBottom: '1rem' }}>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#666' }}>Calle</label>
                      <input type="text" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }} value={formData.street} onChange={e => setFormData({...formData, street: e.target.value})} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#666' }}>Nro</label>
                      <input type="text" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }} value={formData.number} onChange={e => setFormData({...formData, number: e.target.value})} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#666' }}>Piso</label>
                      <input type="text" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }} value={formData.floor} onChange={e => setFormData({...formData, floor: e.target.value})} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#666' }}>Dto</label>
                      <input type="text" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }} value={formData.apartment} onChange={e => setFormData({...formData, apartment: e.target.value})} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '0.5rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#666' }}>Provincia</label>
                      <select style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', backgroundColor: 'white' }} value={formData.province} onChange={e => setFormData({...formData, province: e.target.value})}>
                        <option value="">Seleccione...</option>
                        {provinces.map(prov => <option key={prov} value={prov}>{prov}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#666' }}>Ciudad</label>
                      <input type="text" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }} value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#666' }}>C. Postal</label>
                      <input type="text" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }} value={formData.postalCode} onChange={e => setFormData({...formData, postalCode: e.target.value})} />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: activeTab === 'documents' ? 'block' : 'none' }}>
                {!editingId ? (
                  <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f9f9f9', borderRadius: '8px', color: '#666' }}>
                    Para poder cargar documentos, primero debes guardar el perfil de este nuevo paciente.
                  </div>
                ) : (
                  <div>
                    <div style={{ marginTop: '1rem', background: '#f8f9fa', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <h4 style={{ margin: 0 }}>Subir Nuevo Documento</h4>
                        <button
                          type="button"
                          onClick={handleOpenPatientQr}
                          title="Subir foto desde celular (QR)"
                          style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', fontSize: '0.82rem', color: '#475569' }}
                        >
                          <QrCode size={15} /> QR
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'end' }}>
                          <div>
                            <label style={{ fontSize: '0.9rem', display: 'block', marginBottom: '4px' }}>Archivo</label>
                            <input 
                              type="file" 
                              multiple
                              onChange={(e) => setDocUploadFile(e.target.files)} 
                              accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
                              className="form-control"
                              style={{ width: '100%', padding: '5px', borderRadius: '8px', border: '1px solid #ddd', background: 'white' }}
                              id="patient-file-upload"
                            />
                          </div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', background: '#f0f9ff', padding: '6px 12px', borderRadius: '8px', border: '1px solid #bae6fd', color: '#0369a1' }}>
                            <input 
                              type="checkbox" 
                              checked={isConformityChecked}
                              onChange={(e) => setIsConformityChecked(e.target.checked)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                            <span>¿Es Certificado de Conformidad?</span>
                          </label>
                        </div>
                        <button 
                          type="button" 
                          onClick={handleFileUpload} 
                          className="btn btn-primary" 
                          disabled={!docUploadFile || docUploadFile.length === 0}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                        >
                          <Upload size={16} /> Subir Documento
                        </button>
                      </div>
                    </div>

                    <div style={{ border: '1px solid #eee', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                      {patientDocs.length > 0 ? patientDocs.map(doc => (
                        <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', borderBottom: '1px solid #eee', backgroundColor: doc.isConformity ? '#f0f9ff' : 'white' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <button 
                              type="button" 
                              onClick={() => setShowingDoc(doc)}
                              style={{ background: 'none', border: 'none', padding: 0, textDecoration: 'none', color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.9rem', textAlign: 'left', cursor: 'pointer' }}
                            >
                              {doc.originalName}
                            </button>
                            {doc.isConformity && (
                              <span style={{ fontSize: '0.7rem', background: '#0369a1', color: 'white', padding: '2px 8px', borderRadius: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                                C. Conformidad
                              </span>
                            )}
                          </div>
                          <button type="button" onClick={() => handleDeleteDoc(doc.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )) : (
                        <div style={{ padding: '1rem', textAlign: 'center', color: '#999', fontSize: '0.9rem' }}>
                          No hay documentos cargados.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: activeTab === 'tests' ? 'block' : 'none' }}>
                {!editingId ? (
                  <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f9f9f9', borderRadius: '8px', color: '#666' }}>
                    Para poder cargar pruebas, primero debes guardar el perfil de este nuevo paciente.
                  </div>
                ) : (
                  <div>
                    <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#666' }}>Prueba</label>
                        <div 
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', backgroundColor: 'white', cursor: 'pointer', minHeight: '35px', display: 'flex', alignItems: 'center' }}
                          onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'testSearch' ? null : 'testSearch'); }}
                        >
                           <span style={{ color: newTest.testId ? 'inherit' : '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                             {newTest.testId ? availableTests.find(t => t.id === newTest.testId)?.name : 'Seleccione una prueba...'}
                           </span>
                        </div>
                        
                        {activeDropdown === 'testSearch' && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '6px', marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '300px', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                               <input 
                                 type="text" 
                                 autoFocus
                                 placeholder="Buscar por nombre o descripción..."
                                 value={testSearchQuery}
                                 onChange={e => setTestSearchQuery(e.target.value)}
                                 style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                               />
                            </div>
                            <div style={{ overflowY: 'auto' }}>
                               {availableTests
                                 .filter(t => 
                                   t.name.toLowerCase().includes(testSearchQuery.toLowerCase()) || 
                                   t.category.toLowerCase().includes(testSearchQuery.toLowerCase()) ||
                                   (t.description && t.description.toLowerCase().includes(testSearchQuery.toLowerCase()))
                                 )
                                 .map(t => (
                                 <div 
                                   key={t.id} 
                                   style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f9f9f9' }}
                                   onClick={() => {
                                      setNewTest({...newTest, testId: t.id});
                                      setActiveDropdown(null);
                                      setTestSearchQuery('');
                                   }}
                                 >
                                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{t.name}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#666' }}>{t.category}</div>
                                 </div>
                               ))}
                               {availableTests.filter(t => t.name.toLowerCase().includes(testSearchQuery.toLowerCase()) || t.category.toLowerCase().includes(testSearchQuery.toLowerCase()) || (t.description && t.description.toLowerCase().includes(testSearchQuery.toLowerCase()))).length === 0 && (
                                 <div style={{ padding: '8px 12px', color: '#999', fontSize: '0.85rem', textAlign: 'center' }}>No se encontraron pruebas.</div>
                               )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ width: '140px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#666' }}>Fecha</label>
                        <input 
                          type="date" 
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
                          value={newTest.date}
                          onChange={e => setNewTest({...newTest, date: e.target.value})}
                          max={getLocalDate()}
                        />
                      </div>
                      <button 
                        type="button"
                        className="btn btn-primary" 
                        onClick={handleAddTest}
                        disabled={!newTest.testId || !newTest.date}
                      >
                        Agregar
                      </button>
                    </div>

                    <div style={{ border: '1px solid #eee', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                      {isLoadingTests ? (
                        <div style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>Cargando pruebas...</div>
                      ) : patientTests.length > 0 ? patientTests.map(pt => (
                        <div key={pt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', borderBottom: '1px solid #eee' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <ClipboardList size={18} color="var(--primary)" />
                            <div>
                              <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--primary)' }}>{pt.Test?.name}</div>
                              <div style={{ fontSize: '0.8rem', color: '#666' }}>{pt.Test?.category} | {new Date(pt.date + 'T12:00:00').toLocaleDateString()}</div>
                            </div>
                          </div>
                          {isAdmin && (
                            <button type="button" onClick={() => handleDeleteTest(pt.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      )) : (
                        <div style={{ padding: '1rem', textAlign: 'center', color: '#999', fontSize: '0.9rem' }}>
                          No hay pruebas registradas.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }}>Guardar Paciente</button>
            </form>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', left: '12px', top: '12px', color: '#888' }} size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nombre o documento..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '12px 12px 12px 40px', 
              borderRadius: '8px', 
              border: '1px solid #ddd' 
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingLeft: '4px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', cursor: 'pointer', color: '#555' }}>
            <input 
              type="checkbox"
              checked={showOnlyActive}
              onChange={e => setShowOnlyActive(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            Mostrar solo pacientes activos
          </label>

          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#eee', borderRadius: '8px', padding: '4px' }}>
            <button
              onClick={() => setViewMode('list')}
              style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', background: viewMode === 'list' ? 'white' : 'transparent', borderRadius: '6px', cursor: 'pointer', boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', color: viewMode === 'list' ? '#333' : '#777', transition: 'all 0.2s' }}
            >
              <List size={18} /> Lista
            </button>
            <button
              onClick={() => setViewMode('card')}
              style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', background: viewMode === 'card' ? 'white' : 'transparent', borderRadius: '6px', cursor: 'pointer', boxShadow: viewMode === 'card' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', color: viewMode === 'card' ? '#333' : '#777', transition: 'all 0.2s' }}
            >
              <Grid size={18} /> Tarjetas
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', background: 'white', borderRadius: '12px', border: '1px solid #eee' }}>
          <div style={{
            width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid var(--primary)',
            borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '1rem'
          }}></div>
          <span style={{ color: '#666', fontWeight: '500' }}>Cargando pacientes...</span>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      ) : viewMode === 'list' ? (
        <div className="card">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--soft-gray)' }}>
              <th style={{ padding: '1rem', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('firstName')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>Paciente {getSortIcon('firstName')}</div>
              </th>
              <th style={{ padding: '1rem', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('docNumber')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>Documento {getSortIcon('docNumber')}</div>
              </th>
              <th style={{ padding: '1rem', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('phone')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>Contacto {getSortIcon('phone')}</div>
              </th>
              <th style={{ padding: '1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>C.Inf.</th>
              <th style={{ padding: '1rem' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredPatients.length > 0 ? filteredPatients.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--soft-gray)', transition: 'background 0.2s' }}>
                <td style={{ padding: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {p.lastName}, {p.firstName}
                  {p.PatientDocuments && p.PatientDocuments.length > 0 && (
                    <FileText size={16} color="#666" style={{ flexShrink: 0, marginLeft: '4px' }} title="Tiene documentos" />
                  )}
                  {p.isInactive && <span style={{ fontSize: '0.7rem', backgroundColor: '#fee2e2', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fca5a5' }}>INACTIVO</span>}
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--dark-text)' }}>{formatDocument(p.docNumber)}</div>
                  <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>{p.DocumentType?.name || 'S/D'}</div>
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ fontSize: '0.85rem' }}>{formatPhone(p.phone)}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{p.email || 'Sin email'}</div>
                </td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                  {p.PatientDocuments?.some(d => d.isConformity) ? (
                    <div title="Certificado Cargado">
                      <FileText size={20} color="#0369a1" style={{ margin: 'auto' }} />
                    </div>
                  ) : (
                    <span style={{ opacity: 0.2 }}>-</span>
                  )}
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button className="btn" style={{ padding: '6px', background: 'transparent' }} onClick={() => openViewModal(p)} title="Ver Detalles">
                      <Eye size={18} color="#4a90e2" />
                    </button>
                    <button className="btn" style={{ padding: '6px', background: 'transparent' }} onClick={() => handleEdit(p)} title="Editar Paciente">
                      <Edit3 size={18} color="#4a90e2" />
                    </button>
                    <button className="btn" style={{ padding: '6px', background: 'transparent' }} onClick={() => openActivities(p)} title="Historia Clínica">
                      <Activity size={18} color="var(--light-blue)" />
                    </button>
                    
                    <div style={{ position: 'relative' }}>
                      <button 
                        className="btn" 
                        style={{ padding: '6px', background: 'transparent' }} 
                        onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === p.id ? null : p.id); }}
                      >
                        <MoreVertical size={18} color="#666" />
                      </button>
                      
                      {activeDropdown === p.id && (
                        <div style={{
                          position: 'absolute', right: 0, top: '100%', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '160px', padding: '8px 0'
                        }}>
                          <button style={{ width: '100%', textAlign: 'left', padding: '10px 15px', border: 'none', background: 'none', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => openSessions(p)}>
                            <Calendar size={16} color="var(--primary)" /> <span style={{ fontSize: '0.9rem' }}>Sesiones</span>
                          </button>
                          {isAdmin && (
                            <>
                              <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }}></div>
                              <button style={{ width: '100%', textAlign: 'left', padding: '10px 15px', border: 'none', background: 'none', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: '#ef4444' }} onClick={() => handleDeletePatient(p.id)}>
                                <Trash2 size={16} /> <span style={{ fontSize: '0.9rem' }}>Borrar</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>No se encontraron pacientes.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {filteredPatients.length > 0 ? filteredPatients.map(p => (
            <div key={p.id} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', position: 'relative', border: '1px solid #eaeaea', borderRadius: '12px' }}>
              {p.isInactive && (
                <span style={{ position: 'absolute', top: '15px', right: '15px', fontSize: '0.7rem', backgroundColor: '#fee2e2', color: '#ef4444', padding: '4px 8px', borderRadius: '6px', border: '1px solid #fca5a5', fontWeight: 'bold' }}>
                  INACTIVO
                </span>
              )}
              <h3 style={{ margin: '0 0 1rem 0', paddingRight: '60px', color: 'var(--dark-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {p.lastName}, {p.firstName}
                {p.PatientDocuments && p.PatientDocuments.length > 0 && (
                  <FileText size={18} color="#666" style={{ flexShrink: 0 }} title="Tiene documentos" />
                )}
              </h3>
              
              <div style={{ marginBottom: '1.2rem', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#555', fontSize: '0.9rem' }}>
                  <span style={{ fontWeight: 'bold', minWidth: '85px', color: '#444' }}>Documento:</span> 
                  <span>{formatDocument(p.docNumber)} ({p.DocumentType?.name || 'S/D'})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#555', fontSize: '0.9rem' }}>
                  <span style={{ fontWeight: 'bold', minWidth: '85px', color: '#444' }}>Teléfono:</span> {formatPhone(p.phone)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#555', fontSize: '0.9rem' }}>
                  <span style={{ fontWeight: 'bold', minWidth: '70px', color: '#444' }}>Email:</span> {p.email || 'N/A'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#555', fontSize: '0.9rem' }}>
                  <span style={{ fontWeight: 'bold', minWidth: '70px', color: '#444' }}>C. Inf.:</span> {p.PatientDocuments?.some(d => d.isConformity) ? '✅ Cargado' : '❌ Pendiente'}
                </div>
                {(p.city || p.province || p.street) && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#555', fontSize: '0.9rem' }}>
                    <span style={{ fontWeight: 'bold', minWidth: '70px', color: '#444' }}>Ciudad:</span> {p.city || p.province || p.street}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #eee', paddingTop: '1rem', marginTop: 'auto', alignItems: 'center' }}>
                <button className="btn" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', padding: '8px', border: '1px solid #eee', background: '#fcfcfc', color: '#555', fontSize: '0.85rem' }} onClick={() => openViewModal(p)}>
                  <Eye size={16} color="#4a90e2" /> Ver
                </button>
                <button className="btn" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', padding: '8px', border: '1px solid #eee', background: '#fcfcfc', color: '#555', fontSize: '0.85rem' }} onClick={() => handleEdit(p)}>
                  <Edit3 size={16} color="#4a90e2" /> Editar
                </button>
                <button className="btn" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', padding: '8px', border: '1px solid #eee', background: '#fcfcfc', color: '#555', fontSize: '0.85rem' }} onClick={() => openActivities(p)}>
                  <Activity size={16} color="var(--light-blue)" /> H. Clín.
                </button>
                
                <div style={{ position: 'relative' }}>
                  <button 
                    className="btn" 
                    style={{ padding: '8px', border: '1px solid #eee', background: '#fcfcfc' }}
                    onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === p.id ? null : p.id); }}
                  >
                    <MoreVertical size={16} color="#666" />
                  </button>
                  
                  {activeDropdown === p.id && (
                    <div style={{
                      position: 'absolute', right: 0, bottom: '100%', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '8px',
                      boxShadow: '0 -4px 12px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '160px', padding: '8px 0', marginBottom: '8px'
                    }}>
                      <button style={{ width: '100%', textAlign: 'left', padding: '10px 15px', border: 'none', background: 'none', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => openSessions(p)}>
                        <Calendar size={16} color="var(--primary)" /> <span style={{ fontSize: '0.9rem' }}>Sesiones</span>
                      </button>
                      {isAdmin && (
                        <>
                          <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }}></div>
                          <button style={{ width: '100%', textAlign: 'left', padding: '10px 15px', border: 'none', background: 'none', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: '#ef4444' }} onClick={() => handleDeletePatient(p.id)}>
                            <Trash2 size={16} /> <span style={{ fontSize: '0.9rem' }}>Borrar</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )) : (
            <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: '#888', background: 'white', border: '1px solid #eee', borderRadius: '12px' }}>
              No se encontraron pacientes.
            </div>
          )}
        </div>
      )}

      {/* Activities Modal */}
      {showActivitiesModal && selectedPatient && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', position: 'relative', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <button 
              onClick={() => { stopDictation(); setShowActivitiesModal(false); setSelectedPatient(null); setNewActivityDesc(''); }}
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>
            <h2 style={{ marginBottom: '1.5rem', paddingRight: '30px' }}>Historia Clínica - {selectedPatient.lastName}, {selectedPatient.firstName}</h2>
            
            {/* Activities List */}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '10px' }}>
              {activities.length > 0 ? activities.map(act => (
                <div key={act.id} style={{ padding: '15px', border: '1px solid #eee', borderRadius: '8px', marginBottom: '1rem', backgroundColor: '#fdfdfd' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', color: '#666' }}>
                    <strong>{act.Professional ? `${act.Professional.firstName} ${act.Professional.lastName}` : 'Profesional'}</strong>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span>{new Date(act.date || act.createdAt).toLocaleString()}</span>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button type="button" onClick={() => startEditActivity(act)} style={{ background: 'transparent', border: 'none', color: '#4a90e2', cursor: 'pointer' }}><Edit3 size={14} /></button>
                          <button type="button" onClick={() => handleDeleteActivity(act.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                  {editingActivityId === act.id ? (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#666', fontWeight: 'bold' }}>Editar Nota</span>
                        <button
                          type="button"
                          onClick={() => toggleDictation(setEditingActivityDesc, `edit-${act.id}`)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 10px',
                            borderRadius: '16px',
                            border: isListening && listeningField === `edit-${act.id}` ? '1px solid #ef4444' : '1px solid #3b82f6',
                            backgroundColor: isListening && listeningField === `edit-${act.id}` ? '#fee2e2' : '#eff6ff',
                            color: isListening && listeningField === `edit-${act.id}` ? '#dc2626' : '#2563eb',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                          }}
                          title="Dictar por voz (es-AR)"
                        >
                          {isListening && listeningField === `edit-${act.id}` ? <MicOff size={14} /> : <Mic size={14} />}
                          {isListening && listeningField === `edit-${act.id}` ? 'Detener (es-AR)' : 'Dictar Voz (es-AR)'}
                        </button>
                      </div>
                      {isListening && listeningField === `edit-${act.id}` && (
                        <div style={{ fontSize: '0.75rem', color: '#dc2626', marginBottom: '6px', fontWeight: '500' }}>
                          🔴 Escuchando voz (es-AR)... hable ahora.
                        </div>
                      )}
                      <textarea 
                        rows="3" 
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                        value={editingActivityDesc}
                        onChange={e => setEditingActivityDesc(e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn" onClick={() => { stopDictation(); setEditingActivityId(null); }}>Cancelar</button>
                        <button type="button" className="btn btn-primary" onClick={() => { stopDictation(); handleUpdateActivity(act.id); }}>Guardar</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap', color: 'var(--dark-text)' }}>{act.description}</div>
                  )}
                </div>
              )) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>No hay actividades registradas.</div>
              )}
            </div>

            {/* Add Activity Form */}
            <form onSubmit={(e) => { stopDictation(); handleAddActivity(e); }} style={{ borderTop: '2px solid var(--soft-gray)', paddingTop: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Nueva Historia Clínica</label>
                  <button
                    type="button"
                    onClick={() => toggleDictation(setNewActivityDesc, 'new')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 12px',
                      borderRadius: '20px',
                      border: isListening && listeningField === 'new' ? '1px solid #ef4444' : '1px solid #3b82f6',
                      backgroundColor: isListening && listeningField === 'new' ? '#fee2e2' : '#eff6ff',
                      color: isListening && listeningField === 'new' ? '#dc2626' : '#2563eb',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      transition: 'all 0.2s ease'
                    }}
                    title="Dictar por voz en castellano argentino (es-AR)"
                  >
                    {isListening && listeningField === 'new' ? (
                      <>
                        <MicOff size={16} />
                        <span>Detener Dictado (es-AR)</span>
                      </>
                    ) : (
                      <>
                        <Mic size={16} />
                        <span>Dictar por Voz (es-AR)</span>
                      </>
                    )}
                  </button>
                </div>
                {isListening && listeningField === 'new' && (
                  <div style={{ fontSize: '0.8rem', color: '#dc2626', marginBottom: '8px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#dc2626', display: 'inline-block' }}></span>
                    Escuchando voz (es-AR)... hable y el texto se transcribirá automáticamente.
                  </div>
                )}
                <textarea 
                  required
                  rows="3"
                  placeholder="Ej: Evolución favorable, se observa mejoría en..."
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', resize: 'vertical' }}
                  value={newActivityDesc}
                  onChange={e => setNewActivityDesc(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', color: 'var(--dark-text)' }}>Agregar a Historia Clínica</button>
            </form>
          </div>
        </div>
      )}

      {/* Read-Only Patient View Modal */}
      {showViewModal && viewingPatient && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button 
              onClick={() => { setShowViewModal(false); setViewingPatient(null); }}
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>
            <h2 style={{ marginBottom: '1.5rem', borderBottom: '2px solid #f0f0f0', paddingBottom: '10px' }}>
              Detalle del Paciente
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Personal info section */}
              <div>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '10px' }}>Datos Personales</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px' }}>
                   <p style={{ margin: 0 }}><strong>Nombre:</strong> {viewingPatient.firstName}</p>
                   <p style={{ margin: 0 }}><strong>Apellido:</strong> {viewingPatient.lastName}</p>
                   <p style={{ margin: 0 }}><strong>Documento:</strong> {formatDocument(viewingPatient.docNumber)} ({viewingPatient.DocumentType?.name || 'S/D'})</p>
                   <p style={{ margin: 0 }}><strong>Teléfono:</strong> {formatPhone(viewingPatient.phone)}</p>
                   <p style={{ margin: 0 }}><strong>Email:</strong> {viewingPatient.email || 'N/A'}</p>
                   <p style={{ margin: 0 }}><strong>Fecha de Nac.:</strong> {viewingPatient.birthDate || 'N/A'}</p>
                   {viewingPatient.isInactive && <p style={{ margin: 0, color: '#ef4444', fontWeight: 'bold', gridColumn: '1 / -1', marginTop: '8px' }}>ESTADO: INACTIVO</p>}
                </div>
              </div>

              {/* Address section */}
              <div>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '10px' }}>Dirección</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px' }}>
                   <p style={{ margin: 0, gridColumn: '1 / -1' }}><strong>Calle y Nro:</strong> {viewingPatient.street || 'N/A'} {viewingPatient.number || ''}</p>
                   <p style={{ margin: 0 }}><strong>Piso:</strong> {viewingPatient.floor || 'N/A'}</p>
                   <p style={{ margin: 0 }}><strong>Depto:</strong> {viewingPatient.apartment || 'N/A'}</p>
                   <p style={{ margin: 0 }}><strong>Ciudad:</strong> {viewingPatient.city || 'N/A'}</p>
                   <p style={{ margin: 0 }}><strong>Provincia:</strong> {viewingPatient.province || 'N/A'}</p>
                   <p style={{ margin: 0 }}><strong>C. Postal:</strong> {viewingPatient.postalCode || 'N/A'}</p>
                </div>
              </div>

              {/* Documents section */}
              <div>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '10px' }}>Documentos</h3>
                <div style={{ border: '1px solid #eee', borderRadius: '8px', padding: '15px', backgroundColor: '#f9f9f9' }}>
                  {viewingPatient.PatientDocuments && viewingPatient.PatientDocuments.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {viewingPatient.PatientDocuments.map(doc => (
                        <li key={doc.id} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <button 
                            type="button" 
                            onClick={() => setShowingDoc(doc)}
                            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--light-blue)', textDecoration: 'none', fontWeight: 'bold', cursor: 'pointer', textAlign: 'left' }}
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

              {/* Tests section */}
              <div>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '10px' }}>Pruebas Realizadas</h3>
                <div style={{ border: '1px solid #eee', borderRadius: '8px', padding: '15px', backgroundColor: '#f9f9f9', maxHeight: '200px', overflowY: 'auto' }}>
                  {isLoadingTests ? (
                    <p style={{ margin: 0, color: '#888', fontStyle: 'italic' }}>Cargando pruebas...</p>
                  ) : patientTests && patientTests.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {patientTests.map(pt => (
                        <li key={pt.id} style={{ marginBottom: '8px' }}>
                          <span style={{ fontWeight: 'bold' }}>{pt.Test?.name}</span>
                          <span style={{ color: '#666', fontSize: '0.9rem', marginLeft: '8px' }}>
                            ({pt.Test?.category}) - {new Date(pt.date + 'T12:00:00').toLocaleDateString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ margin: 0, color: '#888', fontStyle: 'italic' }}>No hay pruebas registradas.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Patient QR Photo Upload Modal */}
      {showPatientQrModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', maxWidth: '380px', width: '90%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 8px', color: '#1e293b' }}>Subir foto con celular</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 20px' }}>
              Escaneá este código QR con la cámara del celular para subir una foto al paciente.<br />
              <strong>Válido por 15 minutos.</strong>
            </p>
            {patientQrLoading ? (
              <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 40, height: 40, border: '4px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : patientQrUrl ? (
              <>
                <div style={{ display: 'inline-block', padding: '12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                  <QRCodeSVG value={patientQrUrl} size={200} level="M" />
                </div>
                <p style={{ fontSize: '0.72rem', color: '#94a3b8', wordBreak: 'break-all', marginTop: '10px', maxWidth: '300px' }}>{patientQrUrl}</p>
              </>
            ) : null}
            <button
              onClick={() => { setShowPatientQrModal(false); /* reload docs */ api.get(`/patients/${editingId}`).then(r => setPatientDocs(r.data.PatientDocuments || [])); }}
              style={{ marginTop: '16px', width: '100%', padding: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}
            >
              Listo
            </button>
          </div>
        </div>
      )}

      {/* Message Modal */}
      <MessageModal 
        isOpen={msgModal.isOpen}
        message={msgModal.message}
        type={msgModal.type}
        onCancel={msgModal.onConfirm ? () => setMsgModal({ ...msgModal, isOpen: false }) : null}
        onClose={() => {
          if (msgModal.onConfirm) msgModal.onConfirm();
          setMsgModal({ ...msgModal, isOpen: false, onConfirm: null });
        }}
      />

      {/* Document Viewer Modal */}
      {showingDoc && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', 
          justifyContent: 'center', alignItems: 'center', zIndex: 1100, backdropFilter: 'blur(6px)'
        }}>
          <div style={{ 
            backgroundColor: 'white', 
            width: isDocMaximized ? '100%' : '90%', 
            maxWidth: isDocMaximized ? '100%' : '1000px', 
            height: isDocMaximized ? '100%' : '85vh', 
            borderRadius: isDocMaximized ? '0' : '16px', 
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            transition: 'all 0.3s ease'
          }}>
            {/* Modal Header */}
            <div style={{ 
              padding: '0.8rem 1.5rem', borderBottom: '1px solid #eee', display: 'flex', 
              justifyContent: 'space-between', alignItems: 'center', background: '#fcfcfc'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                {showingDoc.originalName}
              </h3>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {showingDoc.url.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) && (
                  <div style={{ display: 'flex', gap: '5px', marginRight: '10px', paddingRight: '10px', borderRight: '1px solid #ddd' }}>
                    <button 
                      onClick={() => setImgZoom(prev => Math.min(prev + 0.1, 3))}
                      style={{ background: '#f0f0f0', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', color: '#555' }}
                      title="Acercar"
                    >
                      <ZoomIn size={18} />
                    </button>
                    <button 
                      onClick={() => setImgZoom(prev => Math.max(prev - 0.1, 0.5))}
                      style={{ background: '#f0f0f0', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', color: '#555' }}
                      title="Alejar"
                    >
                      <ZoomOut size={18} />
                    </button>
                    <button 
                      onClick={() => setImgRotation(prev => (prev + 90) % 360)}
                      style={{ background: '#f0f0f0', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', color: '#555' }}
                      title="Rotar"
                    >
                      <RotateCw size={18} />
                    </button>
                  </div>
                )}
                <button 
                  className="btn btn-primary" 
                  onClick={() => handleDownload(showingDoc)}
                  style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                >
                  Descargar
                </button>
                
                <button 
                  onClick={() => setIsDocMaximized(!isDocMaximized)}
                  style={{ background: '#f0f0f0', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', color: '#555' }}
                  title={isDocMaximized ? "Achicar" : "Maximizar"}
                >
                  {isDocMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>

                <button 
                  onClick={() => { setShowingDoc(null); setIsDocMaximized(false); setImgZoom(1); setImgRotation(0); }}
                  style={{ background: '#fee2e2', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', color: '#ef4444' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Content - File Preview */}
            <div style={{ flex: 1, backgroundColor: '#525659', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'auto', position: 'relative' }}>
              {(() => {
                // Using the specific backend document viewing route which handles S3/Local automatically
                const previewUrl = `${api.defaults.baseURL}/patients/document/${showingDoc.id}/view?token=${localStorage.getItem('token')}`;
                
                // Imágenes
                if (showingDoc.url.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)) {
                  return <img 
                    src={previewUrl} 
                    alt={showingDoc.originalName} 
                    style={{ 
                      maxWidth: imgZoom === 1 ? '100%' : 'none', 
                      maxHeight: imgZoom === 1 ? '100%' : 'none', 
                      objectFit: 'contain',
                      transform: `scale(${imgZoom}) rotate(${imgRotation}deg)`,
                      transition: 'transform 0.2s ease-in-out'
                    }} 
                  />;
                } 
                
                // PDF
                if (showingDoc.url.toLowerCase().endsWith('.pdf')) {
                  return (
                    <iframe 
                      src={previewUrl} 
                      style={{ width: '100%', height: '100%', border: 'none' }} 
                      title="PDF Preview"
                    />
                  );
                } 

                // Otros
                return <div style={{ textAlign: 'center', padding: '3rem', color: 'white' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📄</div>
                    <p style={{ fontSize: '1.1rem' }}>Vista previa no disponible para este tipo de archivo.</p>
                    <button 
                      className="btn btn-primary" 
                      onClick={() => handleDownload(showingDoc)}
                      style={{ marginTop: '1.5rem' }}
                    >
                      Descargar para ver
                    </button>
                  </div>;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Sessions (Appointments) Modal */}
      {showSessionsModal && selectedPatient && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '700px', position: 'relative', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <button 
              onClick={() => { setShowSessionsModal(false); setSelectedPatient(null); }}
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>
            <h2 style={{ marginBottom: '1.5rem', paddingRight: '40px' }}>
               Sesiones del paciente - {selectedPatient.lastName}, {selectedPatient.firstName}
            </h2>
            
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
              {isLoadingSessions ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando sesiones...</div>
              ) : patientSessions.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                      <th style={{ padding: '12px' }}>Fecha</th>
                      <th style={{ padding: '12px' }}>Hora</th>
                      <th style={{ padding: '12px' }}>Profesional</th>
                      <th style={{ padding: '12px' }}>Prestación</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Asistió</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientSessions.map(session => {
                      const sessionDate = new Date(session.startTime);
                      const isExpired = sessionDate < new Date();
                      
                      return (
                        <tr key={session.id} style={{ 
                          borderBottom: '1px solid #f5f5f5',
                          backgroundColor: isExpired ? '#fcfcfc' : '#f0f9ff'
                        }}>
                          <td style={{ padding: '12px', color: isExpired ? '#999' : '#333', fontWeight: isExpired ? 'normal' : 'bold' }}>
                            {sessionDate.toLocaleDateString()}
                          </td>
                          <td style={{ padding: '12px', color: isExpired ? '#999' : '#333' }}>
                            {sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ padding: '12px', color: isExpired ? '#999' : '#333' }}>
                            {session.Professional?.firstName} {session.Professional?.lastName}
                          </td>
                           <td style={{ padding: '12px', color: isExpired ? '#999' : '#333' }}>
                            {session.Benefit?.name}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            {session.attended ? (
                              <CheckCircle2 size={18} color="#059669" style={{ margin: 'auto' }} />
                            ) : (
                              <span style={{ opacity: 0.3 }}>-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
                  No se registraron sesiones para este paciente.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Patients;
