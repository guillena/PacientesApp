import React, { useState, useEffect } from 'react';
import api from '../api';
import { Search, UserPlus, Edit3, X, ArrowUpDown, ArrowUp, ArrowDown, Activity, List, Grid, Eye, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCw, Crop, FileText, FilePlus, Trash2, Calendar, CheckCircle2, MoreVertical, ClipboardList, Upload, Mic, MicOff, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import MessageModal from '../components/MessageModal';
import PatientDetailModal from '../components/PatientDetailModal';
import WhatsAppIcon, { getWhatsAppUrl } from '../components/WhatsAppIcon';
import WordDocumentViewer from '../components/WordDocumentViewer';
import ImageCropperModal from '../components/ImageCropperModal';
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
  const [professionals, setProfessionals] = useState([]);
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
    isInactive: false,
    professionalIds: []
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
  const [showPatientTestsModal, setShowPatientTestsModal] = useState(false);
  const [selectedPatientForTests, setSelectedPatientForTests] = useState(null);

  // View Patient state
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingPatient, setViewingPatient] = useState(null);

  // Document Viewer state
  const [showingDoc, setShowingDoc] = useState(null);
  const [isDocMaximized, setIsDocMaximized] = useState(false);
  const [imgZoom, setImgZoom] = useState(1);
  const [docZoom, setDocZoom] = useState(1);
  const [imgRotation, setImgRotation] = useState(0);
  const [imgPan, setImgPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showCropper, setShowCropper] = useState(false);
  const [cropTimestamp, setCropTimestamp] = useState(Date.now());

  useEffect(() => {
    if (showingDoc) {
      setImgZoom(1);
      setDocZoom(1);
      setImgRotation(0);
      setImgPan({ x: 0, y: 0 });
      setShowCropper(false);
    }
  }, [showingDoc]);

  const [isConformityChecked, setIsConformityChecked] = useState(false);
  const [docUploadFile, setDocUploadFile] = useState(null);

  // Patient Documents Modal states
  const [selectedPatientForDocs, setSelectedPatientForDocs] = useState(null);
  const [showPatientDocsModal, setShowPatientDocsModal] = useState(false);

  const openPatientDocsModal = async (patient) => {
    setSelectedPatientForDocs(patient);
    setDocUploadFile(null);
    setIsConformityChecked(false);
    try {
      const { data } = await api.get(`/patients/${patient.id}`);
      setPatientDocs(data.PatientDocuments || []);
    } catch (e) {
      setPatientDocs(patient.PatientDocuments || []);
    }
    setShowPatientDocsModal(true);
  };

  // QR Photo Upload state (patient)
  const [showPatientQrModal, setShowPatientQrModal] = useState(false);
  const [patientQrUrl, setPatientQrUrl] = useState('');
  const [patientQrLoading, setPatientQrLoading] = useState(false);

  const handleOpenPatientQr = async () => {
    const targetPatientId = selectedPatientForDocs?.id || editingId;
    if (!targetPatientId) return;
    setPatientQrLoading(true);
    setPatientQrUrl('');
    setShowPatientQrModal(true);
    try {
      const res = await api.post(`/patients/${targetPatientId}/photo-token`);
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
    fetchProfessionals();
  }, []);

  const fetchProfessionals = async () => {
    try {
      const response = await api.get('/professionals');
      const sorted = (response.data || []).sort((a, b) => {
        const nameA = `${a.lastName || ''}, ${a.firstName || ''}`.trim();
        const nameB = `${b.lastName || ''}, ${b.firstName || ''}`.trim();
        return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
      });
      setProfessionals(sorted);
    } catch (err) {
      console.error('Error fetching professionals', err);
    }
  };

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
    const targetPatientId = selectedPatientForTests?.id || editingId;
    if (!targetPatientId) return;
    try {
      const response = await api.post(`/patients/${targetPatientId}/tests`, newTest);
      setPatientTests([response.data, ...patientTests].sort((a, b) => new Date(b.date) - new Date(a.date)));
      setNewTest({ testId: '', date: getLocalDate() });
      fetchPatients();
    } catch (err) {
      showMsg('Error al agregar la prueba', 'alert');
    }
  };

  const handleDeleteTest = (testId) => {
    const targetPatientId = selectedPatientForTests?.id || editingId;
    if (!targetPatientId) return;
    showMsg('¿Está seguro de que desea eliminar esta prueba?', 'alert', async () => {
      try {
        await api.delete(`/patients/${targetPatientId}/tests/${testId}`);
        setPatientTests(patientTests.filter(pt => pt.id !== testId));
        fetchPatients();
      } catch (err) {
        showMsg('Error al eliminar la prueba', 'alert');
      }
    });
  };

  const openPatientTestsModal = async (patient) => {
    setSelectedPatientForTests(patient);
    setNewTest({ testId: '', date: getLocalDate() });
    setTestSearchQuery('');
    fetchPatientTests(patient.id);
    setShowPatientTestsModal(true);
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
        firstName: '', lastName: '', docNumber: '', email: '', phone: '', birthDate: '', street: '', number: '', floor: '', apartment: '', province: '', city: '', postalCode: '', docTypeId: '', isInactive: false, professionalIds: []
      });
      await fetchPatients();
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al guardar el paciente. Verifique los datos.';
      showMsg(msg, 'alert');
    }
  };

  const handleToggleProfessional = (profId) => {
    if (editingId && !isAdmin) return;
    setFormData(prev => {
      const current = prev.professionalIds || [];
      const updated = current.includes(profId)
        ? current.filter(id => id !== profId)
        : [...current, profId];
      return { ...prev, professionalIds: updated };
    });
  };

  const handleEdit = async (patient) => {
    const profIds = (patient.Professionals || []).map(p => p.id);
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
      isInactive: patient.isInactive || false,
      professionalIds: profIds
    });
    setPatientDocs(patient.PatientDocuments || []);
    setEditingId(patient.id);
    setActiveTab('personal');
    fetchPatientTests(patient.id);
    setShowModal(true);

    try {
      const { data: fresh } = await api.get(`/patients/${patient.id}`);
      if (fresh && fresh.Professionals) {
        setFormData(prev => ({
          ...prev,
          professionalIds: fresh.Professionals.map(p => p.id)
        }));
      }
    } catch (e) {
      console.warn('Could not fetch fresh patient details:', e);
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setPatientDocs([]);
    setPatientTests([]);
    setFormData({
      firstName: '', lastName: '', docNumber: '', email: '', phone: '', birthDate: '', street: '', number: '', floor: '', apartment: '', province: '', city: '', postalCode: '',
      docTypeId: docTypes.length > 0 ? docTypes[0].id : '',
      isInactive: false,
      professionalIds: (!isAdmin && user?.id) ? [user.id] : []
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
    if (e && e.preventDefault) e.preventDefault();
    const targetPatientId = selectedPatientForDocs?.id || editingId;
    if (!docUploadFile || !targetPatientId) return;

    const files = Array.from(docUploadFile);
    if (files.length === 0) return;

    const uploadFile = async (file) => {
      const data = new FormData();
      data.append('file', file);
      data.append('isConformity', isConformityChecked);
      try {
        const response = await api.post(`/patients/${targetPatientId}/documents`, data, {
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
      setPatientDocs(prevDocs => [...prevDocs, ...results]);
      setSelectedPatientForDocs(prev => prev ? {
        ...prev,
        PatientDocuments: [...(prev.PatientDocuments || []), ...results]
      } : prev);
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
    const targetPatientId = selectedPatientForDocs?.id || editingId;
    if (!targetPatientId) return;
    showMsg('¿Está seguro de que desea eliminar este documento?', 'alert', async () => {
      try {
        await api.delete(`/patients/${targetPatientId}/documents/${docId}`);
        setPatientDocs(prevDocs => prevDocs.filter(d => d.id !== docId));
        setSelectedPatientForDocs(prev => prev ? {
          ...prev,
          PatientDocuments: (prev.PatientDocuments || []).filter(d => d.id !== docId)
        } : prev);
        fetchPatients();
      } catch (err) {
        showMsg('Error al eliminar el documento', 'alert');
      }
    });
  };

  const handleDownload = async (doc) => {
    try {
      const response = await api.get(`/patients/document/${doc.id}/view?download=true`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] || 'application/octet-stream' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.originalName || 'documento');
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Error downloading file:', err);
      showMsg('Error al descargar el documento.', 'alert');
    }
  };

  const handleSavePatientCrop = async (croppedBlob) => {
    try {
      const patId = showingDoc?.patientId || selectedPatientForDocs?.id || editingId || viewingPatient?.id;
      if (!patId || !showingDoc) return;

      const formData = new FormData();
      const fileName = showingDoc.originalName || 'recorte.jpg';
      formData.append('file', croppedBlob, fileName);

      const res = await api.post(`/patients/${patId}/documents/${showingDoc.id}/crop`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const updatedDoc = res.data;
      setShowingDoc(updatedDoc);
      setCropTimestamp(Date.now());
      setImgZoom(1);
      setImgRotation(0);
      setImgPan({ x: 0, y: 0 });

      setPatientDocs(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d));

      if (selectedPatientForDocs) {
        setSelectedPatientForDocs(prev => prev ? ({
          ...prev,
          PatientDocuments: (prev.PatientDocuments || []).map(d => d.id === updatedDoc.id ? updatedDoc : d)
        }) : prev);
      }

      if (viewingPatient && viewingPatient.PatientDocuments) {
        setViewingPatient(prev => ({
          ...prev,
          PatientDocuments: prev.PatientDocuments.map(d => d.id === updatedDoc.id ? updatedDoc : d)
        }));
      }

      setShowCropper(false);
      fetchPatients();
    } catch (err) {
      console.error('Error cropping patient document:', err);
      showMsg('Error al guardar el recorte de la imagen', 'alert');
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
      fetchPatients();
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
        fetchPatients();
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
                {/* Profesionales Asignados */}
                <div style={{ marginBottom: '1.5rem', backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155', margin: 0 }}>
                      Profesionales Asignados
                    </label>
                    {editingId && !isAdmin && (
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                        Solo el administrador puede editar la asignación
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
                    {professionals.map(prof => {
                      const isChecked = (formData.professionalIds || []).includes(prof.id);
                      const isDisabled = editingId && !isAdmin;
                      return (
                        <div 
                          key={prof.id} 
                          onClick={() => {
                            if (!isDisabled) handleToggleProfessional(prof.id);
                          }}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            fontSize: '0.85rem', 
                            padding: '6px 10px', 
                            borderRadius: '6px', 
                            border: isChecked ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                            backgroundColor: isChecked ? '#eff6ff' : '#fff',
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            opacity: isDisabled && !isChecked ? 0.5 : 1,
                            transition: 'all 0.15s ease',
                            userSelect: 'none'
                          }}
                        >
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            disabled={isDisabled}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleToggleProfessional(prof.id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                          />
                          <span style={{ fontWeight: isChecked ? 600 : 400, color: isChecked ? '#1e3a8a' : '#1e293b' }}>
                            {prof.lastName}, {prof.firstName}
                          </span>
                        </div>
                      );
                    })}
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
                <td style={{ padding: '1rem', fontWeight: 'bold' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{p.lastName}, {p.firstName}</span>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
                      {p.PatientDocuments && p.PatientDocuments.length > 0 && (
                        <FileText size={16} color="#666" style={{ flexShrink: 0 }} title="Tiene documentos" />
                      )}
                      {p.Activities && p.Activities.length > 0 && (
                        <Activity size={16} color="var(--light-blue)" style={{ flexShrink: 0 }} title="Tiene historia clínica" />
                      )}
                      {p.PatientTests && p.PatientTests.length > 0 && (
                        <ClipboardList size={16} color="#8b5cf6" style={{ flexShrink: 0 }} title="Tiene pruebas" />
                      )}
                    </div>
                    {p.isInactive && <span style={{ fontSize: '0.7rem', backgroundColor: '#fee2e2', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fca5a5' }}>INACTIVO</span>}
                  </div>
                  {p.Professionals && p.Professionals.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                      {p.Professionals.map(prof => (
                        <span key={prof.id} style={{
                          fontSize: '0.7rem',
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          border: '1px solid #e2e8f0',
                          fontWeight: 'normal'
                        }}>
                          {prof.lastName}, {prof.firstName}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--dark-text)' }}>{formatDocument(p.docNumber)}</div>
                  <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>{p.DocumentType?.name || 'S/D'}</div>
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{formatPhone(p.phone)}</span>
                    {p.phone && getWhatsAppUrl(p.phone) && (
                      <a 
                        href={getWhatsAppUrl(p.phone)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
                        title="Abrir WhatsApp Web"
                      >
                        <WhatsAppIcon size={16} />
                      </a>
                    )}
                  </div>
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
                    <button className="btn" style={{ padding: '6px', background: 'transparent' }} onClick={() => openPatientDocsModal(p)} title="Documentos">
                      <FilePlus size={18} color="#95a5a6" />
                    </button>
                    <button className="btn" style={{ padding: '6px', background: 'transparent' }} onClick={() => openActivities(p)} title="Historia Clínica">
                      <Activity size={18} color="var(--light-blue)" />
                    </button>
                    <button className="btn" style={{ padding: '6px', background: 'transparent' }} onClick={() => openPatientTestsModal(p)} title="Pruebas">
                      <ClipboardList size={18} color="#8b5cf6" />
                    </button>
                    <button className="btn" style={{ padding: '6px', background: 'transparent' }} onClick={() => openSessions(p)} title="Sesiones">
                      <Calendar size={18} color="var(--primary)" />
                    </button>
                    
                    <div style={{ position: 'relative' }}>
                      <button 
                        className="btn" 
                        style={{ padding: '6px', background: 'transparent' }} 
                        onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === p.id ? null : p.id); }}
                        title="Más opciones"
                      >
                        <MoreVertical size={18} color="#666" />
                      </button>
                      
                      {activeDropdown === p.id && (
                        <div style={{
                          position: 'absolute', right: 0, top: '100%', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '130px', padding: '4px 0'
                        }}>
                          <button 
                            style={{ 
                              width: '100%', textAlign: 'left', padding: '10px 15px', border: 'none', background: 'none', 
                              display: 'flex', alignItems: 'center', gap: '10px', 
                              cursor: isAdmin ? 'pointer' : 'not-allowed', 
                              color: isAdmin ? '#ef4444' : '#bbb',
                              transition: 'background 0.2s' 
                            }} 
                            onClick={() => { 
                              if (isAdmin) {
                                setActiveDropdown(null); 
                                handleDeletePatient(p.id); 
                              }
                            }}
                            title={isAdmin ? "Eliminar paciente" : "Solo administradores pueden borrar"}
                          >
                            <Trash2 size={16} /> <span style={{ fontSize: '0.9rem' }}>Borrar</span>
                          </button>
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
              <h3 style={{ margin: '0 0 1rem 0', paddingRight: '60px', color: 'var(--dark-text)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>{p.lastName}, {p.firstName}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {p.PatientDocuments && p.PatientDocuments.length > 0 && (
                    <FileText size={18} color="#666" style={{ flexShrink: 0 }} title="Tiene documentos" />
                  )}
                  {p.Activities && p.Activities.length > 0 && (
                    <Activity size={18} color="var(--light-blue)" style={{ flexShrink: 0 }} title="Tiene historia clínica" />
                  )}
                  {p.PatientTests && p.PatientTests.length > 0 && (
                    <ClipboardList size={18} color="#8b5cf6" style={{ flexShrink: 0 }} title="Tiene pruebas" />
                  )}
                </span>
              </h3>
              
              <div style={{ marginBottom: '1.2rem', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#555', fontSize: '0.9rem' }}>
                  <span style={{ fontWeight: 'bold', minWidth: '85px', color: '#444' }}>Documento:</span> 
                  <span>{formatDocument(p.docNumber)} ({p.DocumentType?.name || 'S/D'})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#555', fontSize: '0.9rem' }}>
                  <span style={{ fontWeight: 'bold', minWidth: '85px', color: '#444' }}>Teléfono:</span> 
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>{formatPhone(p.phone)}</span>
                    {p.phone && getWhatsAppUrl(p.phone) && (
                      <a 
                        href={getWhatsAppUrl(p.phone)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', color: '#25D366' }}
                        title="Abrir WhatsApp Web"
                      >
                        <WhatsAppIcon size={16} />
                      </a>
                    )}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#555', fontSize: '0.9rem' }}>
                  <span style={{ fontWeight: 'bold', minWidth: '70px', color: '#444' }}>Email:</span> {p.email || 'N/A'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#555', fontSize: '0.9rem' }}>
                  <span style={{ fontWeight: 'bold', minWidth: '70px', color: '#444' }}>C. Inf.:</span> {p.PatientDocuments?.some(d => d.isConformity) ? '✅ Cargado' : '❌ Pendiente'}
                </div>
                {(p.city || p.province || p.street) && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px', color: '#555', fontSize: '0.9rem' }}>
                    <span style={{ fontWeight: 'bold', minWidth: '70px', color: '#444' }}>Ciudad:</span> {p.city || p.province || p.street}
                  </div>
                )}
                {p.Professionals && p.Professionals.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#555', fontSize: '0.9rem' }}>
                    <span style={{ fontWeight: 'bold', minWidth: '85px', color: '#444' }}>Profesionales:</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {p.Professionals.map(prof => (
                        <span key={prof.id} style={{
                          fontSize: '0.75rem',
                          backgroundColor: '#eff6ff',
                          color: '#1d4ed8',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid #bfdbfe'
                        }}>
                          {prof.lastName}, {prof.firstName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #eee', paddingTop: '1rem', marginTop: 'auto', alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn" style={{ flex: 1, minWidth: '55px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', padding: '8px', border: '1px solid #eee', background: '#fcfcfc', color: '#555', fontSize: '0.85rem' }} onClick={() => openViewModal(p)} title="Ver Detalles">
                  <Eye size={16} color="#4a90e2" /> Ver
                </button>
                <button className="btn" style={{ flex: 1, minWidth: '60px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', padding: '8px', border: '1px solid #eee', background: '#fcfcfc', color: '#555', fontSize: '0.85rem' }} onClick={() => handleEdit(p)} title="Editar Paciente">
                  <Edit3 size={16} color="#4a90e2" /> Editar
                </button>
                <button className="btn" style={{ flex: 1, minWidth: '58px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', padding: '8px', border: '1px solid #eee', background: '#fcfcfc', color: '#555', fontSize: '0.85rem' }} onClick={() => openPatientDocsModal(p)} title="Documentos">
                  <FilePlus size={16} color="#95a5a6" /> Docs
                </button>
                <button className="btn" style={{ flex: 1, minWidth: '68px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', padding: '8px', border: '1px solid #eee', background: '#fcfcfc', color: '#555', fontSize: '0.85rem' }} onClick={() => openActivities(p)} title="Historia Clínica">
                  <Activity size={16} color="var(--light-blue)" /> H. Clín.
                </button>
                <button className="btn" style={{ flex: 1, minWidth: '68px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', padding: '8px', border: '1px solid #eee', background: '#fcfcfc', color: '#555', fontSize: '0.85rem' }} onClick={() => openPatientTestsModal(p)} title="Pruebas">
                  <ClipboardList size={16} color="#8b5cf6" /> Pruebas
                </button>
                <button className="btn" style={{ flex: 1, minWidth: '68px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', padding: '8px', border: '1px solid #eee', background: '#fcfcfc', color: '#555', fontSize: '0.85rem' }} onClick={() => openSessions(p)} title="Sesiones">
                  <Calendar size={16} color="var(--primary)" /> Sesiones
                </button>
                
                <div style={{ position: 'relative' }}>
                  <button 
                    className="btn" 
                    style={{ padding: '8px', border: '1px solid #eee', background: '#fcfcfc' }}
                    onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === p.id ? null : p.id); }}
                    title="Más opciones"
                  >
                    <MoreVertical size={16} color="#666" />
                  </button>
                  
                  {activeDropdown === p.id && (
                    <div style={{
                      position: 'absolute', right: 0, bottom: '100%', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '8px',
                      boxShadow: '0 -4px 12px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '130px', padding: '4px 0', marginBottom: '8px'
                    }}>
                      <button 
                        style={{ 
                          width: '100%', textAlign: 'left', padding: '10px 15px', border: 'none', background: 'none', 
                          display: 'flex', alignItems: 'center', gap: '10px', 
                          cursor: isAdmin ? 'pointer' : 'not-allowed', 
                          color: isAdmin ? '#ef4444' : '#bbb',
                          transition: 'background 0.2s'
                        }} 
                        onClick={() => { 
                          if (isAdmin) {
                            setActiveDropdown(null); 
                            handleDeletePatient(p.id); 
                          }
                        }}
                        title={isAdmin ? "Eliminar paciente" : "Solo administradores pueden borrar"}
                      >
                        <Trash2 size={16} /> <span style={{ fontSize: '0.9rem' }}>Borrar</span>
                      </button>
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
              onClick={() => { stopDictation(); setShowActivitiesModal(false); setSelectedPatient(null); setNewActivityDesc(''); fetchPatients(); }}
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
        <PatientDetailModal
          isOpen={showViewModal}
          patient={viewingPatient}
          onClose={() => { setShowViewModal(false); setViewingPatient(null); }}
          tests={patientTests}
          isLoadingTests={isLoadingTests}
        />
      )}

      {/* Patient Documents Modal */}
      {showPatientDocsModal && selectedPatientForDocs && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button 
              onClick={() => { setShowPatientDocsModal(false); setSelectedPatientForDocs(null); fetchPatients(); }} 
              style={{ position: 'absolute', right: '15px', top: '15px', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <X />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '36px' }}>
              <h2>Documentos de {selectedPatientForDocs.firstName} {selectedPatientForDocs.lastName}</h2>
              <button
                type="button"
                onClick={handleOpenPatientQr}
                title="Subir foto desde celular con QR"
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', borderRadius: '8px',
                  background: 'var(--primary, #4f46e5)', color: 'white',
                  border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}
              >
                <QrCode size={16} /> QR
              </button>
            </div>
            
            <div style={{ marginTop: '1rem', background: '#f8f9fa', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Subir Nuevo Documento</h4>
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

            <h4>Documentos Subidos</h4>
            <div style={{ border: '1px solid #eee', borderRadius: '8px', maxHeight: '280px', overflowY: 'auto' }}>
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
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" onClick={() => handleDeleteDoc(doc.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }} title="Eliminar Documento">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )) : (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#999', fontSize: '0.9rem' }}>
                  No hay documentos cargados.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Patient Tests Modal */}
      {showPatientTestsModal && selectedPatientForTests && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '650px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button 
              onClick={() => { setShowPatientTestsModal(false); setSelectedPatientForTests(null); fetchPatients(); }} 
              style={{ position: 'absolute', right: '15px', top: '15px', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <X />
            </button>
            <h2 style={{ marginBottom: '1.2rem', paddingRight: '36px' }}>
              Pruebas de {selectedPatientForTests.firstName} {selectedPatientForTests.lastName}
            </h2>

            {/* Selector de nueva prueba */}
            <div style={{ marginBottom: '1.5rem', background: '#f8f9fa', padding: '1.2rem', borderRadius: '10px', border: '1px solid #eee' }}>
              <h4 style={{ margin: '0 0 12px 0', color: 'var(--primary)' }}>Asignar Nueva Prueba</h4>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#666' }}>Prueba</label>
                  <div 
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', backgroundColor: 'white', cursor: 'pointer', minHeight: '38px', display: 'flex', alignItems: 'center' }}
                    onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'testSearch' ? null : 'testSearch'); }}
                  >
                     <span style={{ color: newTest.testId ? 'inherit' : '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                       {newTest.testId ? availableTests.find(t => t.id === newTest.testId)?.name : 'Seleccione una prueba...'}
                     </span>
                  </div>
                  
                  {activeDropdown === 'testSearch' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '6px', marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '250px', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                         <input 
                           type="text" 
                           autoFocus
                           placeholder="Buscar por nombre o categoría..."
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
                             style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f9f9f9', backgroundColor: newTest.testId === t.id ? '#f0f9ff' : 'white' }}
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
                <div style={{ width: '150px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#666' }}>Fecha</label>
                  <input 
                    type="date" 
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', height: '38px', boxSizing: 'border-box' }}
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
                  style={{ height: '38px', padding: '0 18px', fontWeight: 600 }}
                >
                  Agregar
                </button>
              </div>
            </div>

            {/* Lista de pruebas */}
            <h4>Pruebas Realizadas</h4>
            <div style={{ border: '1px solid #eee', borderRadius: '8px', maxHeight: '300px', overflowY: 'auto' }}>
              {isLoadingTests ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#666' }}>Cargando pruebas...</div>
              ) : patientTests.length > 0 ? patientTests.map(pt => (
                <div key={pt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #eee' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <ClipboardList size={20} color="var(--primary)" />
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--primary)' }}>{pt.Test?.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '2px' }}>{pt.Test?.category} | {new Date(pt.date + 'T12:00:00').toLocaleDateString()}</div>
                    </div>
                  </div>
                  {isAdmin && (
                    <button type="button" onClick={() => handleDeleteTest(pt.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px', borderRadius: '6px' }} title="Eliminar prueba">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              )) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#999', fontSize: '0.9rem' }}>
                  No hay pruebas registradas para este paciente.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Patient QR Photo Upload Modal */}
      {showPatientQrModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', maxWidth: '380px', width: '90%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', position: 'relative' }}>
            <button 
              onClick={() => { 
                const targetPatientId = selectedPatientForDocs?.id || editingId;
                setShowPatientQrModal(false); 
                if (targetPatientId) {
                  api.get(`/patients/${targetPatientId}`).then(r => setPatientDocs(r.data.PatientDocuments || []));
                }
                fetchPatients(); 
              }} 
              style={{ position: 'absolute', right: '15px', top: '15px', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
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
              onClick={() => { 
                const targetPatientId = selectedPatientForDocs?.id || editingId;
                setShowPatientQrModal(false); 
                if (targetPatientId) {
                  api.get(`/patients/${targetPatientId}`).then(r => setPatientDocs(r.data.PatientDocuments || []));
                }
                fetchPatients(); 
              }}
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
          justifyContent: 'center', alignItems: 'center', zIndex: 1300, backdropFilter: 'blur(6px)'
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
                  <div style={{ display: 'flex', gap: '5px', marginRight: '10px', paddingRight: '10px', borderRight: '1px solid #ddd', alignItems: 'center' }}>
                    <button 
                      onClick={() => setImgZoom(prev => {
                        const next = Math.max(Math.round((prev - 0.1) * 10) / 10, 0.5);
                        if (next <= 1) setImgPan({ x: 0, y: 0 });
                        return next;
                      })}
                      style={{ background: '#f0f0f0', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', color: '#555' }}
                      title="Alejar"
                    >
                      <ZoomOut size={18} />
                    </button>
                    <span 
                      onClick={() => { setImgZoom(1); setImgPan({ x: 0, y: 0 }); }}
                      style={{ fontSize: '0.8rem', color: '#666', minWidth: '42px', textAlign: 'center', userSelect: 'none', cursor: 'pointer', fontWeight: '500' }}
                      title="Click para restablecer al 100%"
                    >
                      {Math.round(imgZoom * 100)}%
                    </span>
                    <button 
                      onClick={() => setImgZoom(prev => Math.min(Math.round((prev + 0.1) * 10) / 10, 3))}
                      style={{ background: '#f0f0f0', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', color: '#555' }}
                      title="Acercar"
                    >
                      <ZoomIn size={18} />
                    </button>
                    <button 
                      onClick={() => setImgRotation(prev => (prev + 90) % 360)}
                      style={{ background: '#f0f0f0', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', color: '#555' }}
                      title="Rotar"
                    >
                      <RotateCw size={18} />
                    </button>
                    <button 
                      onClick={() => setShowCropper(true)}
                      style={{ background: '#f0f0f0', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', color: '#555' }}
                      title="Recortar y Guardar"
                    >
                      <Crop size={18} />
                    </button>
                  </div>
                )}
                {/* Word documents (.doc, .docx) zoom controls */}
                {((showingDoc.url || '').toLowerCase().match(/\.(docx?)$/) || (showingDoc.originalName || '').toLowerCase().match(/\.(docx?)$/)) && (
                  <div style={{ display: 'flex', gap: '5px', marginRight: '10px', paddingRight: '10px', borderRight: '1px solid #ddd', alignItems: 'center' }}>
                    <button 
                      onClick={() => setDocZoom(prev => Math.max(Math.round((prev - 0.1) * 10) / 10, 0.5))}
                      style={{ background: '#f0f0f0', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', color: '#555' }}
                      title="Alejar"
                    >
                      <ZoomOut size={18} />
                    </button>
                    <span 
                      onClick={() => setDocZoom(1)}
                      style={{ fontSize: '0.8rem', color: '#666', minWidth: '42px', textAlign: 'center', userSelect: 'none', cursor: 'pointer', fontWeight: '500' }}
                      title="Click para restablecer al 100%"
                    >
                      {Math.round(docZoom * 100)}%
                    </span>
                    <button 
                      onClick={() => setDocZoom(prev => Math.min(Math.round((prev + 0.1) * 10) / 10, 2.5))}
                      style={{ background: '#f0f0f0', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', color: '#555' }}
                      title="Acercar"
                    >
                      <ZoomIn size={18} />
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
                  onClick={() => { setShowingDoc(null); setIsDocMaximized(false); setImgZoom(1); setDocZoom(1); setImgRotation(0); setImgPan({ x: 0, y: 0 }); setShowCropper(false); }}
                  style={{ background: '#fee2e2', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', color: '#ef4444' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Content - File Preview */}
            <div 
              onMouseDown={(e) => {
                if (imgZoom > 1) {
                  e.preventDefault();
                  setIsDragging(true);
                  setDragStart({ x: e.clientX - imgPan.x, y: e.clientY - imgPan.y });
                }
              }}
              onMouseMove={(e) => {
                if (isDragging && imgZoom > 1) {
                  e.preventDefault();
                  setImgPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
                }
              }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              onTouchStart={(e) => {
                if (imgZoom > 1 && e.touches.length === 1) {
                  setIsDragging(true);
                  setDragStart({ x: e.touches[0].clientX - imgPan.x, y: e.touches[0].clientY - imgPan.y });
                }
              }}
              onTouchMove={(e) => {
                if (isDragging && imgZoom > 1 && e.touches.length === 1) {
                  setImgPan({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
                }
              }}
              onTouchEnd={() => setIsDragging(false)}
              style={{ 
                flex: 1, 
                backgroundColor: '#525659', 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                overflow: 'hidden', 
                position: 'relative',
                cursor: imgZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
              }}
            >
              {(() => {
                // Using the specific backend document viewing route which handles S3/Local automatically
                const previewUrl = `${api.defaults.baseURL}/patients/document/${showingDoc.id}/view?token=${localStorage.getItem('token')}&t=${cropTimestamp}`;
                
                // Imágenes
                if (showingDoc.url.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)) {
                  return <img 
                    src={previewUrl} 
                    alt={showingDoc.originalName} 
                    draggable={false}
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '100%', 
                      objectFit: 'contain',
                      transform: `translate(${imgPan.x}px, ${imgPan.y}px) scale(${imgZoom}) rotate(${imgRotation}deg)`,
                      transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                      userSelect: 'none',
                      pointerEvents: 'none'
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

                // Documentos Word (.doc, .docx)
                const docNameLower = (showingDoc.originalName || showingDoc.url || '').toLowerCase();
                if (docNameLower.match(/\.(docx?)$/)) {
                  return (
                    <WordDocumentViewer 
                      fileUrl={showingDoc.url}
                      fileName={showingDoc.originalName || 'Documento Word'}
                      docId={showingDoc.id}
                      type="patient"
                      zoom={docZoom}
                      onZoomChange={setDocZoom}
                      onDownload={() => handleDownload(showingDoc)}
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

      {/* Image Cropper Modal */}
      {showCropper && showingDoc && (
        <ImageCropperModal
          isOpen={showCropper}
          imageUrl={`${api.defaults.baseURL}/patients/document/${showingDoc.id}/view?token=${localStorage.getItem('token')}&t=${cropTimestamp}`}
          fileName={showingDoc.originalName || 'recorte'}
          initialRotation={imgRotation}
          onSave={handleSavePatientCrop}
          onCancel={() => setShowCropper(false)}
        />
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
