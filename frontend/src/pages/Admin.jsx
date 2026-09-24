import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import { 
  Plus, Edit3, Trash2, X, Users, Settings, ChevronUp, ChevronDown, 
  Eye, EyeOff, Folder, Download, ClipboardList, Search, ChevronLeft, ChevronRight, FileText, Upload, File, FilePlus,
  ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2, QrCode
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import MessageModal from '../components/MessageModal';

const Admin = () => {
  const [activeTab, setActiveTab] = useState('professionals'); // 'professionals', 'benefits', 'archive' or 'tests'
  
  // State for Professionals
  const [professionals, setProfessionals] = useState([]);
  const [isLoadingProfs, setIsLoadingProfs] = useState(false);
  const [showProfModal, setShowProfModal] = useState(false);
  const [editingProfId, setEditingProfId] = useState(null);
  const [profForm, setProfForm] = useState({ firstName: '', lastName: '', username: '', password: '', role: 'professional', color: '#b9d3fd', benefitIds: [] });
  const [profSortConfig, setProfSortConfig] = useState({ key: 'firstName', direction: 'asc' });

  // State for Benefits (Prestaciones)
  const [benefits, setBenefits] = useState([]);
  const [showServModal, setShowServModal] = useState(false);
  const [editingServId, setEditingServId] = useState(null);
  const [servForm, setServForm] = useState({ name: '', description: '', isAdmission: false });
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [showPassword, setShowPassword] = useState(false);

  // State for Tests (Pruebas)
  const [tests, setTests] = useState([]);
  const [isLoadingTests, setIsLoadingTests] = useState(false);
  const [testCategories, setTestCategories] = useState([]);
  const [testCategoryFilter, setTestCategoryFilter] = useState('ALL');
  const [testSearch, setTestSearch] = useState('');
  const [testSortConfig, setTestSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [testPage, setTestPage] = useState(1);
  const [testItemsPerPage, setTestItemsPerPage] = useState(15);
  const [showTestModal, setShowTestModal] = useState(false);
  const [editingTestId, setEditingTestId] = useState(null);
  
  // Document Viewer states
  const [showingDoc, setShowingDoc] = useState(null);
  const [imgZoom, setImgZoom] = useState(1);
  const [imgRotation, setImgRotation] = useState(0);
  const [isDocMaximized, setIsDocMaximized] = useState(false);
  const [testForm, setTestForm] = useState({ name: '', category: '', customCategory: '', description: '', active: true, isNewCat: false });
  
  // State for Global Messages
  
  // State for Prof Doc Types
  const [profDocTypes, setProfDocTypes] = useState([]);
  const [showProfDocTypeModal, setShowProfDocTypeModal] = useState(false);
  const [editingProfDocTypeId, setEditingProfDocTypeId] = useState(null);
  const [profDocTypeForm, setProfDocTypeForm] = useState({ name: '', description: '', status: true });

  // State for Professional Documents
  const [showProfDocsModal, setShowProfDocsModal] = useState(false);
  const [selectedProfForDocs, setSelectedProfForDocs] = useState(null);
  const [profDocs, setProfDocs] = useState([]);
  const [docUploadForm, setDocUploadForm] = useState({ profDocTypeId: '', file: null });

  // State for QR Photo Upload
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [qrLoading, setQrLoading] = useState(false);

  const [msgModal, setMsgModal] = useState({ isOpen: false, message: '', type: 'info', onConfirm: null });

  const showMsg = (message, type = 'info', onConfirm = null) => {
    setMsgModal({ isOpen: true, message, type, onConfirm });
  };

  useEffect(() => {
    fetchProfessionals();
    fetchBenefits();
    fetchTests();
    fetchTestCategories();
    fetchProfDocTypes();
  }, []);

  useEffect(() => {
    setTestPage(1);
  }, [testSearch, testCategoryFilter]);

  // --- Professionals Methods ---
  const fetchProfessionals = async () => {
    setIsLoadingProfs(true);
    try {
      const { data } = await api.get('/professionals');
      setProfessionals(data);
    } catch (err) { console.error(err); }
    finally { setIsLoadingProfs(false); }
  };

  const handleProfSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProfId) {
        await api.patch(`/professionals/${editingProfId}`, profForm);
      } else {
        await api.post('/professionals', profForm);
      }
      setShowProfModal(false);
      fetchProfessionals();
    } catch (err) { 
      const msg = err.response?.data?.error || 'Error al guardar profesional.';
      showMsg(msg, 'alert'); 
    }
  };

  const openProfModal = (prof = null) => {
    if (prof) {
      setEditingProfId(prof.id);
      setProfForm({ 
        firstName: prof.firstName, 
        lastName: prof.lastName, 
        username: prof.username, 
        role: prof.role,
        color: prof.color || '#b9d3fd',
        benefitIds: prof.Benefits ? prof.Benefits.map(b => b.id) : [],
        password: '' 
      });
    } else {
      setEditingProfId(null);
      setProfForm({ firstName: '', lastName: '', username: '', password: '', role: 'professional', color: '#b9d3fd', benefitIds: [] });
    }
    setShowPassword(false);
    setShowProfModal(true);
  };

  const handleProfSort = (key) => {
    let direction = 'asc';
    if (profSortConfig.key === key && profSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setProfSortConfig({ key, direction });
  };

  const handleProfDelete = async (id) => {
    showMsg(
      '¿Estás seguro de que quieres eliminar este profesional? Esta acción no se puede deshacer.', 
      'info', 
      async () => {
        try {
          await api.delete(`/professionals/${id}`);
          fetchProfessionals();
        } catch (err) {
          showMsg('Error al eliminar profesional.', 'alert');
        }
      }
    );
  };

  const handleDownloadAll = async () => {
    try {
      showMsg('Generando archivo comprimido. La descarga comenzará en breve...', 'info');
      const response = await api.get('/professionals/download-all', { responseType: 'blob' });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const now = new Date();
      const YYYY = now.getFullYear();
      const MM = String(now.getMonth() + 1).padStart(2, '0');
      const DD = String(now.getDate()).padStart(2, '0');
      const HH = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const timestamp = `${YYYY}${MM}${DD}${HH}${mm}`;
      
      link.setAttribute('download', `buketkume${timestamp}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      showMsg('Error al descargar el archivo del bucket.', 'alert');
    }
  };

  const sortedProfessionals = useMemo(() => {
    const sortableItems = [...professionals];
    if (profSortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[profSortConfig.key];
        let bValue = b[profSortConfig.key];
        
        if (profSortConfig.key === 'firstName') {
          aValue = `${a.firstName} ${a.lastName}`.toLowerCase();
          bValue = `${b.firstName} ${b.lastName}`.toLowerCase();
        } else if (profSortConfig.key === 'username' || profSortConfig.key === 'role') {
          aValue = aValue ? aValue.toLowerCase() : '';
          bValue = bValue ? bValue.toLowerCase() : '';
        }

        if (aValue < bValue) {
          return profSortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return profSortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [professionals, profSortConfig]);

  
  // --- Prof Doc Types Methods ---
  const fetchProfDocTypes = async () => {
    try {
      const { data } = await api.get('/prof-doc-types');
      setProfDocTypes(data);
    } catch (err) { console.error(err); }
  };

  const handleProfDocTypeSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProfDocTypeId) {
        await api.patch(`/prof-doc-types/${editingProfDocTypeId}`, profDocTypeForm);
      } else {
        await api.post('/prof-doc-types', profDocTypeForm);
      }
      setShowProfDocTypeModal(false);
      fetchProfDocTypes();
    } catch (err) {
      showMsg(err.response?.data?.error || 'Error al guardar tipo de documento.', 'alert');
    }
  };

  const openProfDocTypeModal = (type = null) => {
    if (type) {
      setEditingProfDocTypeId(type.id);
      setProfDocTypeForm({ name: type.name, description: type.description || '', status: type.status });
    } else {
      setEditingProfDocTypeId(null);
      setProfDocTypeForm({ name: '', description: '', status: true });
    }
    setShowProfDocTypeModal(true);
  };

  const handleProfDocTypeDelete = async (id) => {
    showMsg('¿Estás seguro de que quieres eliminar este tipo de documento?', 'info', async () => {
      try {
        await api.delete(`/prof-doc-types/${id}`);
        fetchProfDocTypes();
      } catch (err) {
        showMsg('No se puede eliminar. Puede que haya documentos asociados.', 'alert');
      }
    });
  };

  // --- Prof Documents Methods ---
  const openProfDocsModal = async (prof) => {
    setSelectedProfForDocs(prof);
    setDocUploadForm({ profDocTypeId: '', file: null });
    await fetchProfDocs(prof.id);
    setShowProfDocsModal(true);
  };

  const fetchProfDocs = async (profId) => {
    try {
      const { data } = await api.get(`/professionals/${profId}/documents`);
      setProfDocs(data);
    } catch (err) { console.error(err); }
  };

  const handleDocUpload = async (e) => {
    e.preventDefault();
    if (!docUploadForm.file || !docUploadForm.profDocTypeId) return;
    
    const formData = new FormData();
    formData.append('file', docUploadForm.file);
    formData.append('profDocTypeId', docUploadForm.profDocTypeId);

    try {
      await api.post(`/professionals/${selectedProfForDocs.id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setDocUploadForm({ profDocTypeId: '', file: null });
      fetchProfDocs(selectedProfForDocs.id);
    } catch (err) {
      showMsg('Error al subir el documento', 'alert');
    }
  };

  const handleDocDelete = (docId) => {
    showMsg('¿Seguro de eliminar este documento?', 'alert', async () => {
      try {
        await api.delete(`/professionals/${selectedProfForDocs.id}/documents/${docId}`);
        setProfDocs(profDocs.filter(d => d.id !== docId));
      } catch (err) {
        showMsg('Error al eliminar', 'alert');
      }
    });
  };

  const handleDownload = (doc) => {
    try {
      const downloadUrl = `${api.defaults.baseURL}/professionals/documents/${doc.id}/view?token=${localStorage.getItem('token')}`;
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = doc.originalName || 'documento';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      showMsg('Error al intentar descargar el documento.', 'alert');
    }
  };

  const handleOpenQr = async () => {
    if (!selectedProfForDocs) return;
    setQrLoading(true);
    setQrUrl('');
    setShowQrModal(true);
    try {
      const { data } = await api.post(`/professionals/${selectedProfForDocs.id}/photo-token`);
      setQrUrl(data.url);
    } catch (err) {
      showMsg('Error al generar el código QR.', 'alert');
      setShowQrModal(false);
    } finally {
      setQrLoading(false);
    }
  };

// --- Benefits Methods ---
  const fetchBenefits = async () => {
    try {
      const { data } = await api.get('/benefits');
      setBenefits(data);
    } catch (err) { console.error(err); }
  };

  const handleServSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingServId) {
        await api.patch(`/benefits/${editingServId}`, servForm);
      } else {
        await api.post('/benefits', servForm);
      }
      setShowServModal(false);
      fetchBenefits();
    } catch (err) { 
      showMsg('Error al guardar prestación.', 'alert'); 
    }
  };

  const openServModal = (serv = null) => {
    if (serv) {
      setEditingServId(serv.id);
      setServForm({ ...serv });
    } else {
      setEditingServId(null);
      setServForm({ name: '', description: '', isAdmission: false });
    }
    setShowServModal(true);
  };

  const handleServDelete = async (id) => {
    showMsg(
      '¿Estás seguro de que quieres eliminar esta prestación? Se eliminarán también todas las citas asociadas.', 
      'info', 
      async () => {
        try {
          await api.delete(`/benefits/${id}`);
          fetchBenefits(); // Just refresh without showing success modal
        } catch (err) {
          if (err.response?.status === 400) {
            const errorData = err.response.data.error;
            showMsg(errorData, 'alert');
          } else {
            showMsg('Lo sentimos, ha ocurrido un sistema en el servidor al intentar eliminar la prestación.', 'alert');
          }
        }
      }
    );
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedBenefits = useMemo(() => {
    const sortableItems = [...benefits];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [benefits, sortConfig]);

  const toggleBenefitSelection = (id) => {
    const currentIds = [...profForm.benefitIds];
    const index = currentIds.indexOf(id);
    if (index === -1) {
      currentIds.push(id);
    } else {
      currentIds.splice(index, 1);
    }
    setProfForm({ ...profForm, benefitIds: currentIds });
  };

  // --- Tests Methods ---
  const fetchTests = async () => {
    setIsLoadingTests(true);
    try {
      const { data } = await api.get('/tests');
      setTests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingTests(false);
    }
  };

  const fetchTestCategories = async () => {
    try {
      const { data } = await api.get('/tests/categories');
      setTestCategories(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestSubmit = async (e) => {
    e.preventDefault();
    const finalCategory = testForm.isNewCat ? testForm.customCategory.trim() : testForm.category.trim();
    if (!testForm.name.trim()) {
      showMsg('El nombre de la prueba es requerido.', 'alert');
      return;
    }
    if (!finalCategory) {
      showMsg('La categoría de la prueba es requerida.', 'alert');
      return;
    }

    const payload = {
      name: testForm.name.trim(),
      category: finalCategory,
      description: testForm.description ? testForm.description.trim() : '',
      active: testForm.active
    };

    try {
      if (editingTestId) {
        await api.patch(`/tests/${editingTestId}`, payload);
      } else {
        await api.post('/tests', payload);
      }
      setShowTestModal(false);
      fetchTests();
      fetchTestCategories();
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al guardar la prueba.';
      showMsg(msg, 'alert');
    }
  };

  const openTestModal = (test = null) => {
    if (test) {
      setEditingTestId(test.id);
      setTestForm({
        name: test.name,
        category: test.category,
        customCategory: '',
        description: test.description || '',
        active: test.active !== undefined ? test.active : true,
        isNewCat: false
      });
    } else {
      setEditingTestId(null);
      setTestForm({
        name: '',
        category: testCategories.length > 0 ? testCategories[0] : '',
        customCategory: '',
        description: '',
        active: true,
        isNewCat: false
      });
    }
    setShowTestModal(true);
  };

  const handleTestDelete = async (id) => {
    showMsg(
      '¿Estás seguro de que quieres eliminar esta prueba? Esta acción no se puede deshacer.',
      'info',
      async () => {
        try {
          await api.delete(`/tests/${id}`);
          fetchTests();
          fetchTestCategories();
        } catch (err) {
          const msg = err.response?.data?.error || 'Error al eliminar la prueba.';
          showMsg(msg, 'alert');
        }
      }
    );
  };

  const handleTestSort = (key) => {
    let direction = 'asc';
    if (testSortConfig.key === key && testSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setTestSortConfig({ key, direction });
  };

  const filteredSortedTests = useMemo(() => {
    let result = [...tests];

    if (testCategoryFilter && testCategoryFilter !== 'ALL') {
      result = result.filter(t => t.category === testCategoryFilter);
    }

    if (testSearch && testSearch.trim()) {
      const q = testSearch.toLowerCase().trim();
      result = result.filter(t => 
        (t.name && t.name.toLowerCase().includes(q)) || 
        (t.description && t.description.toLowerCase().includes(q))
      );
    }

    if (testSortConfig.key !== null) {
      result.sort((a, b) => {
        const valA = (a[testSortConfig.key] || '').toString().toLowerCase();
        const valB = (b[testSortConfig.key] || '').toString().toLowerCase();
        if (valA < valB) return testSortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return testSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [tests, testCategoryFilter, testSearch, testSortConfig]);

  const totalTestPages = Math.max(1, Math.ceil(filteredSortedTests.length / testItemsPerPage));
  const paginatedTests = useMemo(() => {
    const startIndex = (testPage - 1) * testItemsPerPage;
    return filteredSortedTests.slice(startIndex, startIndex + testItemsPerPage);
  }, [filteredSortedTests, testPage, testItemsPerPage]);

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>Panel de Administración</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '2rem', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
        <button 
          className={`btn ${activeTab === 'professionals' ? 'btn-primary' : ''}`} 
          style={{ 
            display: 'flex', alignItems: 'center', gap: '8px', 
            background: activeTab === 'professionals' ? 'var(--primary)' : 'transparent', 
            color: activeTab === 'professionals' ? 'white' : 'var(--dark)',
            border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer'
          }}
          onClick={() => setActiveTab('professionals')}
        >
          <Users size={18} /> Profesionales
        </button>
        <button 
          className={`btn ${activeTab === 'benefits' ? 'btn-primary' : ''}`} 
          style={{ 
            display: 'flex', alignItems: 'center', gap: '8px', 
            background: activeTab === 'benefits' ? 'var(--primary)' : 'transparent', 
            color: activeTab === 'benefits' ? 'white' : 'var(--dark)',
            border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer'
          }}
          onClick={() => setActiveTab('benefits')}
        >
          <Settings size={18} /> Prestaciones
        </button>
        <button 
          className={`btn ${activeTab === 'profDocTypes' ? 'btn-primary' : ''}`} 
          style={{ 
            display: 'flex', alignItems: 'center', gap: '8px', 
            background: activeTab === 'profDocTypes' ? 'var(--primary)' : 'transparent', 
            color: activeTab === 'profDocTypes' ? 'white' : 'var(--dark)',
            border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer'
          }}
          onClick={() => setActiveTab('profDocTypes')}
        >
          <FileText size={18} /> Tipos Doc. Prof.
        </button>

        <button 
          className={`btn ${activeTab === 'tests' ? 'btn-primary' : ''}`} 
          style={{ 
            display: 'flex', alignItems: 'center', gap: '8px', 
            background: activeTab === 'tests' ? 'var(--primary)' : 'transparent', 
            color: activeTab === 'tests' ? 'white' : 'var(--dark)',
            border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer'
          }}
          onClick={() => setActiveTab('tests')}
        >
          <ClipboardList size={18} /> Catálogo de Pruebas
        </button>

        <button 
          className={`btn ${activeTab === 'archive' ? 'btn-primary' : ''}`} 
          style={{ 
            display: 'flex', alignItems: 'center', gap: '8px', 
            background: activeTab === 'archive' ? 'var(--primary)' : 'transparent', 
            color: activeTab === 'archive' ? 'white' : 'var(--dark)',
            border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer'
          }}
          onClick={() => setActiveTab('archive')}
        >
          <Folder size={18} /> Archivos
        </button>
      </div>

      {/* Content */}
      <div className="card" style={{ position: 'relative' }}>
        {isLoadingProfs && activeTab === 'professionals' && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(255,255,255,0.6)', display: 'flex', flexDirection: 'column',
            justifyContent: 'center', alignItems: 'center', zIndex: 10, borderRadius: '12px'
          }}>
            <div style={{
              width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid var(--primary)',
              borderRadius: '50%', animation: 'spin-prof 1s linear infinite', marginBottom: '1rem'
            }}></div>
            <span style={{ color: '#666', fontWeight: '500' }}>Cargando profesionales...</span>
            <style>{`@keyframes spin-prof { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        {activeTab === 'professionals' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2>Gestión de Profesionales</h2>
              <button className="btn btn-primary" onClick={() => openProfModal()}>
                <Plus size={18} /> Nuevo Profesional
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--soft-gray)' }}>
                  <th style={{ padding: '1rem', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleProfSort('firstName')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Nombre {profSortConfig.key === 'firstName' && (profSortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </div>
                  </th>
                  <th style={{ padding: '1rem', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleProfSort('username')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Usuario {profSortConfig.key === 'username' && (profSortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </div>
                  </th>
                  <th style={{ padding: '1rem' }}>Prestaciones</th>
                  <th style={{ padding: '1rem', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleProfSort('role')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Rol {profSortConfig.key === 'role' && (profSortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </div>
                  </th>
                  <th style={{ padding: '1rem' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sortedProfessionals.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--soft-gray)' }}>
                    <td style={{ padding: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0, backgroundColor: p.role === 'admin' ? '#95a5a6' : (p.color || '#b9d3fd') }}></div>
                      {p.firstName} {p.lastName}
                      {p.ProfessionalDocuments && p.ProfessionalDocuments.length > 0 && (
                        <FileText size={16} color="#666" style={{ flexShrink: 0, marginLeft: '4px' }} title="Tiene documentos" />
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>{p.username}</td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {p.Benefits && p.Benefits.map(b => (
                          <span key={b.id} style={{ background: '#e3f2fd', color: '#1976d2', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                            {b.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        background: p.role === 'admin' ? 'var(--light-blue)' : 'var(--soft-gray)', 
                        padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem' 
                       }}>
                        {p.role}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn" style={{ padding: '6px', background: 'transparent' }} onClick={() => openProfModal(p)}>
                          <Edit3 size={18} color="var(--salmon)" />
                        </button>
                        <button className="btn" title="Documentos" style={{ padding: '6px', background: 'transparent' }} onClick={() => openProfDocsModal(p)}>
                          <FilePlus size={18} color="#95a5a6" />
                        </button>
                        <button className="btn" style={{ padding: '6px', background: 'transparent' }} onClick={() => handleProfDelete(p.id)}>
                          <Trash2 size={18} color="#e74c3c" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Benefits Tab */}
        {activeTab === 'benefits' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2>Gestión de Prestaciones</h2>
              <button className="btn btn-primary" onClick={() => openServModal()}>
                <Plus size={18} /> Nueva Prestación
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--soft-gray)' }}>
                  {[
                    { label: 'Prestación', key: 'name' },
                    { label: 'Admisión', key: 'isAdmission' },
                    { label: 'Descripción', key: 'description' }
                  ].map(header => (
                    <th 
                      key={header.key} 
                      style={{ padding: '1rem', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort(header.key)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {header.label}
                        {sortConfig.key === header.key ? (
                          sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        ) : null}
                      </div>
                    </th>
                  ))}
                  <th style={{ padding: '1rem' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sortedBenefits.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--soft-gray)' }}>
                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>{s.name}</td>
                    <td style={{ padding: '1rem' }}>
                      {s.isAdmission ? (
                        <span style={{ background: '#f5f5f5', color: '#666', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', border: '1px solid #ddd' }}>
                          Sí
                        </span>
                      ) : (
                        <span style={{ color: '#ccc', fontSize: '0.75rem' }}>No</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#666' }}>{s.description}</td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn" style={{ padding: '6px', background: 'transparent' }} onClick={() => openServModal(s)}>
                          <Edit3 size={18} color="var(--salmon)" />
                        </button>
                        <button className="btn" style={{ padding: '6px', background: 'transparent' }} onClick={() => handleServDelete(s.id)}>
                          <Trash2 size={18} color="#e74c3c" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        
        {/* Prof Doc Types Tab */}
        {activeTab === 'profDocTypes' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2>Tipos de Documento para Profesionales</h2>
              <button className="btn btn-primary" onClick={() => openProfDocTypeModal()}>
                <Plus size={18} /> Nuevo Tipo
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--soft-gray)' }}>
                  <th style={{ padding: '1rem' }}>Nombre</th>
                  <th style={{ padding: '1rem' }}>Descripción</th>
                  <th style={{ padding: '1rem' }}>Estado</th>
                  <th style={{ padding: '1rem' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {profDocTypes.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--soft-gray)' }}>
                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>{t.name}</td>
                    <td style={{ padding: '1rem' }}>{t.description}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        background: t.status ? '#e3f2fd' : '#ffebee', 
                        color: t.status ? '#1976d2' : '#c62828', 
                        padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem' 
                      }}>
                        {t.status ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn" style={{ padding: '6px', background: 'transparent' }} onClick={() => openProfDocTypeModal(t)}>
                          <Edit3 size={18} color="var(--salmon)" />
                        </button>
                        <button className="btn" style={{ padding: '6px', background: 'transparent' }} onClick={() => handleProfDocTypeDelete(t.id)}>
                          <Trash2 size={18} color="#e74c3c" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Archive Tab (NEW) */}
        {activeTab === 'archive' && (
          <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ 
                width: '80px', 
                height: '80px', 
                borderRadius: '50%', 
                background: '#f0f9ff', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto 1.5rem',
                color: 'var(--primary)'
              }}>
                <Folder size={40} />
              </div>
              
              <h2 style={{ marginBottom: '1rem' }}>Respaldo de Documentos</h2>
              
              <p style={{ color: '#666', marginBottom: '2rem', lineHeight: '1.6' }}>
                Desde aquí puede descargar la totalidad de los archivos almacenados en el servidor. 
                Se generará un archivo comprimido <strong>.zip</strong> respetando la organización original 
                (carpetas por paciente y sus respectivos documentos).
              </p>

              <div style={{ 
                backgroundColor: '#fff9db', 
                padding: '1rem', 
                borderRadius: '8px', 
                border: '1px solid #ffe066',
                marginBottom: '2rem',
                fontSize: '0.9rem',
                color: '#856404',
                textAlign: 'left'
              }}>
                <strong>Nota:</strong> Dependiendo de la cantidad total de archivos, este proceso puede demorar unos segundos mientras se prepara la descarga.
              </div>

              <button 
                className="btn btn-primary" 
                style={{ 
                  width: '100%', 
                  padding: '1rem', 
                  fontSize: '1.1rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '12px' 
                }}
                onClick={handleDownloadAll}
              >
                <Download size={22} />
                Descargar Todo el Bucket
              </button>
              
              <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', opacity: 0.5 }}>
                El archivo se llamará: buketkumeYYYYMMDDHHMM.zip
              </div>
            </div>
          </div>
        )}

        {/* Tests Tab */}
        {activeTab === 'tests' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  Catálogo de Pruebas
                  <span style={{ fontSize: '0.85rem', fontWeight: 'normal', background: '#eef2f6', color: '#555', padding: '4px 10px', borderRadius: '12px' }}>
                    {filteredSortedTests.length} {filteredSortedTests.length === 1 ? 'prueba' : 'pruebas'}
                  </span>
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                  Pruebas y técnicas diagnósticas disponibles para evaluación por los profesionales.
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => openTestModal()}>
                <Plus size={18} /> Nueva Prueba
              </button>
            </div>

            {/* Filters Bar */}
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              marginBottom: '1.5rem', 
              flexWrap: 'wrap', 
              alignItems: 'center',
              backgroundColor: '#f8fafc',
              padding: '12px 16px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ position: 'relative', flex: '1 1 250px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input 
                  type="text"
                  placeholder="Buscar por técnica o descripción..."
                  value={testSearch}
                  onChange={e => setTestSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ flex: '1 1 200px' }}>
                <select 
                  value={testCategoryFilter}
                  onChange={e => setTestCategoryFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    background: 'white',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="ALL">Todas las categorías ({tests.length})</option>
                  {testCategories.map(cat => {
                    const count = tests.filter(t => t.category === cat).length;
                    return (
                      <option key={cat} value={cat}>
                        {cat} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>

              {(testSearch || testCategoryFilter !== 'ALL') && (
                <button 
                  className="btn"
                  onClick={() => { setTestSearch(''); setTestCategoryFilter('ALL'); }}
                  style={{ padding: '8px 14px', fontSize: '0.85rem', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Limpiar filtros
                </button>
              )}

              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#64748b' }}>
                <span>Mostrar:</span>
                <select
                  value={testItemsPerPage}
                  onChange={e => { setTestItemsPerPage(Number(e.target.value)); setTestPage(1); }}
                  style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', fontSize: '0.85rem' }}
                >
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Tests Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--soft-gray)' }}>
                    <th 
                      style={{ padding: '1rem', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleTestSort('name')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Técnica / Prueba
                        {testSortConfig.key === 'name' && (
                          testSortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        )}
                      </div>
                    </th>
                    <th 
                      style={{ padding: '1rem', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleTestSort('category')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Categoría
                        {testSortConfig.key === 'category' && (
                          testSortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        )}
                      </div>
                    </th>
                    <th style={{ padding: '1rem' }}>Descripción</th>
                    <th style={{ padding: '1rem', width: '90px' }}>Estado</th>
                    <th style={{ padding: '1rem', width: '100px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingTests ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                        Cargando pruebas...
                      </td>
                    </tr>
                  ) : paginatedTests.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                        No se encontraron pruebas que coincidan con los criterios.
                      </td>
                    </tr>
                  ) : (
                    paginatedTests.map(t => (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--soft-gray)' }}>
                        <td style={{ padding: '1rem', fontWeight: '600', color: 'var(--dark-text)' }}>
                          {t.name}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            background: '#f1f5f9',
                            color: '#334155',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.8rem',
                            fontWeight: '500',
                            border: '1px solid #e2e8f0',
                            display: 'inline-block'
                          }}>
                            {t.category}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
                          {t.description || <span style={{ color: '#cbd5e1' }}>—</span>}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            fontSize: '0.75rem',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: t.active ? '#dcfce7' : '#fee2e2',
                            color: t.active ? '#15803d' : '#b91c1c'
                          }}>
                            {t.active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              className="btn" 
                              style={{ padding: '6px', background: 'transparent' }} 
                              onClick={() => openTestModal(t)}
                              title="Editar prueba"
                            >
                              <Edit3 size={18} color="var(--salmon)" />
                            </button>
                            <button 
                              className="btn" 
                              style={{ padding: '6px', background: 'transparent' }} 
                              onClick={() => handleTestDelete(t.id)}
                              title="Eliminar prueba"
                            >
                              <Trash2 size={18} color="#e74c3c" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredSortedTests.length > 0 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '1rem 0 0 0', 
                marginTop: '1rem', 
                borderTop: '1px solid #f1f5f9',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Mostrando {((testPage - 1) * testItemsPerPage) + 1} - {Math.min(testPage * testItemsPerPage, filteredSortedTests.length)} de {filteredSortedTests.length} pruebas
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    className="btn"
                    disabled={testPage <= 1}
                    onClick={() => setTestPage(prev => Math.max(prev - 1, 1))}
                    style={{
                      padding: '6px 10px',
                      background: testPage <= 1 ? '#f1f5f9' : 'white',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      cursor: testPage <= 1 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <ChevronLeft size={16} color={testPage <= 1 ? '#94a3b8' : '#334155'} />
                  </button>
                  <span style={{ fontSize: '0.85rem', fontWeight: '500', color: '#334155' }}>
                    Página {testPage} de {totalTestPages}
                  </span>
                  <button
                    className="btn"
                    disabled={testPage >= totalTestPages}
                    onClick={() => setTestPage(prev => Math.min(prev + 1, totalTestPages))}
                    style={{
                      padding: '6px 10px',
                      background: testPage >= totalTestPages ? '#f1f5f9' : 'white',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      cursor: testPage >= totalTestPages ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <ChevronRight size={16} color={testPage >= totalTestPages ? '#94a3b8' : '#334155'} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showProfModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setShowProfModal(false)} style={{ position: 'absolute', right: '15px', top: '15px', background: 'transparent', border: 'none', cursor: 'pointer' }}><X /></button>
            <h2>{editingProfId ? 'Editar Profesional' : 'Nuevo Profesional'}</h2>
            <form onSubmit={handleProfSubmit} style={{ marginTop: '1rem' }} autoComplete="off">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label>Nombre</label>
                  <input type="text" required className="form-control" style={{ width: '100%', padding: '8px', borderRadius:'8px', border:'1px solid #ddd'}} value={profForm.firstName} onChange={e => setProfForm({...profForm, firstName: e.target.value})} />
                </div>
                <div>
                  <label>Apellido</label>
                  <input type="text" required className="form-control" style={{ width: '100%', padding: '8px', borderRadius:'8px', border:'1px solid #ddd'}} value={profForm.lastName} onChange={e => setProfForm({...profForm, lastName: e.target.value})} />
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label>Usuario</label>
                <input type="text" autoComplete="none" required className="form-control" style={{ width: '100%', padding: '8px', borderRadius:'8px', border:'1px solid #ddd'}} value={profForm.username} onChange={e => setProfForm({...profForm, username: e.target.value})} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label>Contraseña {editingProfId && '(Dejar en blanco para no cambiar)'}</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    autoComplete="new-password"
                    required={!editingProfId} 
                    className="form-control" 
                    style={{ width: '100%', padding: '8px', paddingRight: '40px', borderRadius:'8px', border:'1px solid #ddd'}} 
                    value={profForm.password} 
                    onChange={e => setProfForm({...profForm, password: e.target.value})} 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: '#666', display: 'flex', alignItems: 'center'
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label>Rol</label>
                <select className="form-control" style={{ width: '100%', padding: '8px', borderRadius:'8px', border:'1px solid #ddd', background:'white'}} value={profForm.role} onChange={e => setProfForm({...profForm, role: e.target.value})}>
                  <option value="professional">Profesional</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '8px' }}>Color asociado</label>
                {profForm.role === 'admin' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#95a5a6' }} />
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Gris por defecto para administradores</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {['#E3F2FD', '#90CAF9', '#42A5F5', '#1976D2', '#E8F5E9', '#A5D6A7', '#66BB6A', '#43A047', '#FFF8E1', '#FFE082', '#FFCA28', '#FFB300', '#FFEBEE', '#FFCDD2', '#EF5350', '#E53935'].map(colorHex => (
                      <div
                        key={colorHex}
                        onClick={() => setProfForm({...profForm, color: colorHex})}
                        style={{
                          width: '24px', height: '24px', backgroundColor: colorHex, borderRadius: '4px', cursor: 'pointer',
                          border: profForm.color === colorHex ? '2px solid #333' : '1px solid #ddd'
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Prestaciones</label>
                <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '8px', padding: '10px' }}>
                  {benefits.map(b => (
                    <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={profForm.benefitIds.includes(b.id)} onChange={() => toggleBenefitSelection(b.id)} />
                      <span style={{ fontSize: '0.9rem' }}>{b.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Guardar</button>
            </form>
          </div>
        </div>
      )}

      {showServModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>
            <button onClick={() => setShowServModal(false)} style={{ position: 'absolute', right: '15px', top: '15px', background: 'transparent', border: 'none', cursor: 'pointer' }}><X /></button>
            <h2>{editingServId ? 'Editar Prestación' : 'Nueva Prestación'}</h2>
            <form onSubmit={handleServSubmit} style={{ marginTop: '1rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label>Nombre</label>
                <input type="text" required className="form-control" style={{ width: '100%', padding: '8px', borderRadius:'8px', border:'1px solid #ddd'}} value={servForm.name} onChange={e => setServForm({...servForm, name: e.target.value})} />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label>Descripción</label>
                <textarea className="form-control" style={{ width: '100%', padding: '8px', borderRadius:'8px', border:'1px solid #ddd'}} value={servForm.description} onChange={e => setServForm({...servForm, description: e.target.value})} />
              </div>
              <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="checkbox" 
                  id="isAdmission"
                  checked={servForm.isAdmission} 
                  onChange={e => setServForm({...servForm, isAdmission: e.target.checked})} 
                />
                <label htmlFor="isAdmission" style={{ cursor: 'pointer', fontSize: '0.9rem' }}>¿Es una prestación de Admisión? (Prospectos)</label>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Guardar</button>
            </form>
          </div>
        </div>
      )}

      {showTestModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', position: 'relative' }}>
            <button onClick={() => setShowTestModal(false)} style={{ position: 'absolute', right: '15px', top: '15px', background: 'transparent', border: 'none', cursor: 'pointer' }}><X /></button>
            <h2>{editingTestId ? 'Editar Prueba' : 'Nueva Prueba'}</h2>
            <form onSubmit={handleTestSubmit} style={{ marginTop: '1.2rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Técnica / Nombre de la Prueba</label>
                <input 
                  type="text" 
                  required 
                  className="form-control" 
                  placeholder="Ej. WISC-V, ADOS-2, D2..."
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} 
                  value={testForm.name} 
                  onChange={e => setTestForm({ ...testForm, name: e.target.value })} 
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontWeight: '500' }}>Categoría</label>
                  <button
                    type="button"
                    onClick={() => setTestForm({ ...testForm, isNewCat: !testForm.isNewCat })}
                    style={{ background: 'none', border: 'none', color: 'var(--salmon)', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
                  >
                    {testForm.isNewCat ? '← Elegir existente' : '+ Nueva categoría'}
                  </button>
                </div>
                {testForm.isNewCat ? (
                  <input 
                    type="text" 
                    required 
                    className="form-control" 
                    placeholder="Nombre de la nueva categoría..."
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} 
                    value={testForm.customCategory} 
                    onChange={e => setTestForm({ ...testForm, customCategory: e.target.value })} 
                  />
                ) : (
                  <select 
                    required 
                    className="form-control" 
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', boxSizing: 'border-box' }} 
                    value={testForm.category} 
                    onChange={e => setTestForm({ ...testForm, category: e.target.value })}
                  >
                    <option value="" disabled>Seleccione una categoría</option>
                    {testCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Descripción / Observaciones (opcional)</label>
                <textarea 
                  rows={3}
                  className="form-control" 
                  placeholder="Detalles sobre aplicación, edad o requisitos..."
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} 
                  value={testForm.description} 
                  onChange={e => setTestForm({ ...testForm, description: e.target.value })} 
                />
              </div>

              <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="checkbox" 
                  id="testActive"
                  checked={testForm.active} 
                  onChange={e => setTestForm({ ...testForm, active: e.target.checked })} 
                />
                <label htmlFor="testActive" style={{ cursor: 'pointer', fontSize: '0.9rem' }}>Prueba activa en el sistema</label>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '10px' }}>
                {editingTestId ? 'Guardar Cambios' : 'Crear Prueba'}
              </button>
            </form>
          </div>
        </div>
      )}

      
      {/* Prof Doc Type Modal */}
      {showProfDocTypeModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>
            <button onClick={() => setShowProfDocTypeModal(false)} style={{ position: 'absolute', right: '15px', top: '15px', background: 'transparent', border: 'none', cursor: 'pointer' }}><X /></button>
            <h2>{editingProfDocTypeId ? 'Editar Tipo de Documento' : 'Nuevo Tipo de Documento'}</h2>
            <form onSubmit={handleProfDocTypeSubmit} style={{ marginTop: '1rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label>Nombre del Documento</label>
                <input type="text" required className="form-control" style={{ width: '100%', padding: '8px', borderRadius:'8px', border:'1px solid #ddd'}} value={profDocTypeForm.name} onChange={e => setProfDocTypeForm({...profDocTypeForm, name: e.target.value})} />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label>Descripción</label>
                <textarea className="form-control" style={{ width: '100%', padding: '8px', borderRadius:'8px', border:'1px solid #ddd'}} value={profDocTypeForm.description} onChange={e => setProfDocTypeForm({...profDocTypeForm, description: e.target.value})} />
              </div>
              <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="checkbox" 
                  id="docStatus"
                  checked={profDocTypeForm.status} 
                  onChange={e => setProfDocTypeForm({...profDocTypeForm, status: e.target.checked})} 
                />
                <label htmlFor="docStatus" style={{ cursor: 'pointer', fontSize: '0.9rem' }}>Activo</label>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Guardar</button>
            </form>
          </div>
        </div>
      )}

      {/* Professional Documents Modal */}
      {showProfDocsModal && selectedProfForDocs && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setShowProfDocsModal(false)} style={{ position: 'absolute', right: '15px', top: '15px', background: 'transparent', border: 'none', cursor: 'pointer' }}><X /></button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '36px' }}>
              <h2>Documentos de {selectedProfForDocs.firstName} {selectedProfForDocs.lastName}</h2>
              <button
                type="button"
                onClick={handleOpenQr}
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
            
            <form onSubmit={handleDocUpload} style={{ marginTop: '1rem', background: '#f8f9fa', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Subir Nuevo Documento</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: '0.9rem' }}>Tipo de Documento</label>
                  <select 
                    required 
                    className="form-control" 
                    style={{ width: '100%', padding: '8px', borderRadius:'8px', border:'1px solid #ddd', background: 'white'}} 
                    value={docUploadForm.profDocTypeId} 
                    onChange={e => setDocUploadForm({...docUploadForm, profDocTypeId: e.target.value})}
                  >
                    <option value="">Seleccionar...</option>
                    {profDocTypes.filter(t => t.status).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.9rem' }}>Archivo</label>
                  <input 
                    type="file" 
                    required 
                    className="form-control" 
                    style={{ width: '100%', padding: '5px', borderRadius:'8px', border:'1px solid #ddd', background: 'white'}} 
                    onChange={e => setDocUploadForm({...docUploadForm, file: e.target.files[0]})} 
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <Upload size={16} /> Subir Documento
              </button>
            </form>

            <h4>Documentos Subidos</h4>
            {profDocs.length === 0 ? (
              <p style={{ color: '#666', fontSize: '0.9rem' }}>No hay documentos subidos.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {profDocs.map(doc => (
                  <li key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                      <strong style={{ color: '#555' }}>{doc.ProfDocType?.name}</strong>
                      <button 
                        type="button" 
                        onClick={() => setShowingDoc(doc)}
                        style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.9rem', textAlign: 'left', cursor: 'pointer' }}
                      >
                        {doc.originalName}
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn" style={{ padding: '6px', background: 'transparent' }} onClick={() => handleDocDelete(doc.id)}>
                        <Trash2 size={18} color="#e74c3c" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* QR Photo Upload Modal */}
      {showQrModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '380px', textAlign: 'center', padding: '2rem', position: 'relative' }}>
            <button onClick={() => setShowQrModal(false)} style={{ position: 'absolute', right: '15px', top: '15px', background: 'transparent', border: 'none', cursor: 'pointer' }}><X /></button>
            <h3 style={{ marginBottom: '0.4rem' }}>Subir foto con celular</h3>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1.2rem' }}>
              Escaneá este código QR con la cámara del celular para subir una foto al profesional.<br/>
              <strong>Válido por 15 minutos.</strong>
            </p>
            {qrLoading ? (
              <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ width: 40, height: 40, border: '4px solid #e2e8f0', borderTopColor: 'var(--primary, #4f46e5)', borderRadius: '50%', animation: 'spin-prof 0.8s linear infinite' }} />
              </div>
            ) : qrUrl ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <div style={{ padding: '16px', background: 'white', borderRadius: '12px', border: '2px solid #e2e8f0', display: 'inline-block' }}>
                  <QRCodeSVG value={qrUrl} size={220} level="M" />
                </div>
                <p style={{ fontSize: '0.78rem', color: '#999', wordBreak: 'break-all', maxWidth: '300px' }}>{qrUrl}</p>
              </div>
            ) : null}
            <button
              className="btn btn-primary"
              style={{ marginTop: '1rem', width: '100%' }}
              onClick={() => { setShowQrModal(false); fetchProfDocs(selectedProfForDocs?.id); }}
            >
              Listo
            </button>
          </div>
        </div>
      )}

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
            <div style={{ 
              padding: '0.8rem 1.5rem', borderBottom: '1px solid #eee', display: 'flex', 
              justifyContent: 'space-between', alignItems: 'center', background: '#fcfcfc'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                {showingDoc.originalName}
              </h3>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {showingDoc.fileUrl.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) && (
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

            <div style={{ flex: 1, backgroundColor: '#525659', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'auto', position: 'relative' }}>
              {(() => {
                const previewUrl = `${api.defaults.baseURL}/professionals/documents/${showingDoc.id}/view?token=${localStorage.getItem('token')}`;
                
                if (showingDoc.fileUrl.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)) {
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
                
                if (showingDoc.fileUrl.toLowerCase().endsWith('.pdf')) {
                  return (
                    <iframe 
                      src={previewUrl} 
                      style={{ width: '100%', height: '100%', border: 'none' }} 
                      title="PDF Preview"
                    />
                  );
                } 

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
    </div>
  );
};

export default Admin;
