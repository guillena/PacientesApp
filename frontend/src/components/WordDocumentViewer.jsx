import React, { useEffect, useRef, useState, useCallback } from 'react';
import { renderAsync } from 'docx-preview';
import api from '../api';
import { FileText, Download, ZoomIn, ZoomOut } from 'lucide-react';

const WordDocumentViewer = ({ 
  fileUrl, 
  fileName, 
  docId, 
  type = 'patient', 
  onDownload,
  zoom: externalZoom,
  onZoomChange
}) => {
  const containerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [htmlContent, setHtmlContent] = useState(null);
  const [isRenderedDocx, setIsRenderedDocx] = useState(false);
  const [internalZoom, setInternalZoom] = useState(1);

  const zoom = externalZoom !== undefined ? externalZoom : internalZoom;

  const updateZoom = useCallback((valOrUpdater) => {
    const nextVal = typeof valOrUpdater === 'function' ? valOrUpdater(zoom) : valOrUpdater;
    const clamped = Math.max(0.5, Math.min(2.5, Math.round(nextVal * 10) / 10));
    if (onZoomChange) {
      onZoomChange(clamped);
    } else {
      setInternalZoom(clamped);
    }
  }, [zoom, onZoomChange]);

  // Ctrl + Mouse wheel zoom support
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        updateZoom(prev => prev + delta);
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, [updateZoom]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setHtmlContent(null);
    setIsRenderedDocx(false);

    const loadDocument = async () => {
      const lowerName = (fileName || fileUrl || '').toLowerCase();
      const isDocx = lowerName.endsWith('.docx');
      const token = localStorage.getItem('token');
      
      const previewUrl = type === 'patient'
        ? `${api.defaults.baseURL}/patients/document/${docId}/view?token=${token}`
        : `${api.defaults.baseURL}/professionals/documents/${docId}/view?token=${token}`;

      const backendPreviewEndpoint = type === 'patient'
        ? `/patients/document/${docId}/doc-preview`
        : `/professionals/documents/${docId}/doc-preview`;

      // 1. If it's .docx, attempt client-side rich rendering with docx-preview first
      if (isDocx) {
        try {
          const res = await fetch(previewUrl);
          if (!res.ok) throw new Error('Error al descargar el archivo para previsualización');
          const blob = await res.blob();
          
          if (!isMounted) return;
          if (containerRef.current) {
            containerRef.current.innerHTML = '';
            await renderAsync(blob, containerRef.current, undefined, {
              inWrapper: true,
              ignoreWidth: false,
              breakPages: true,
              className: 'docx-preview-doc'
            });
            setIsRenderedDocx(true);
            setLoading(false);
            return;
          }
        } catch (docxErr) {
          console.warn('docx-preview fallo, usando fallback de servidor:', docxErr);
        }
      }

      // 2. If it's .doc or docx-preview failed, request backend HTML conversion
      try {
        const { data } = await api.get(backendPreviewEndpoint);
        if (!isMounted) return;
        if (data && data.html) {
          setHtmlContent(data.html);
          setLoading(false);
          return;
        }
        throw new Error('No se recibió contenido para previsualizar');
      } catch (err) {
        if (!isMounted) return;
        console.error('Document preview error:', err);
        setError('No se pudo generar la vista previa de este documento Word.');
        setLoading(false);
      }
    };

    loadDocument();

    return () => {
      isMounted = false;
    };
  }, [docId, fileName, fileUrl, type]);

  const isDocxFormat = (fileName || fileUrl || '').toLowerCase().endsWith('.docx');

  return (
    <div 
      ref={scrollContainerRef}
      style={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'auto',
        backgroundColor: '#525659',
        padding: '24px 16px 80px 16px',
        boxSizing: 'border-box',
        position: 'relative'
      }}
    >
      {loading && (
        <div style={{ minHeight: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', gap: '14px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(255,255,255,0.2)',
            borderTopColor: '#38bdf8',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ margin: 0, fontSize: '0.95rem', color: '#e2e8f0' }}>Cargando documento Word...</p>
        </div>
      )}

      {error && !loading && (
        <div style={{ minHeight: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', textAlign: 'center', maxWidth: '420px', margin: '0 auto', padding: '2rem' }}>
          <FileText size={52} style={{ marginBottom: '1rem', color: '#94a3b8' }} />
          <h4 style={{ margin: '0 0 8px 0', fontSize: '1.1rem' }}>No se pudo previsualizar</h4>
          <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '1.5rem' }}>{error}</p>
          {onDownload && (
            <button 
              className="btn btn-primary" 
              onClick={onDownload}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 18px', fontSize: '0.9rem' }}
            >
              <Download size={16} /> Descargar archivo
            </button>
          )}
        </div>
      )}

      {/* Container for rich docx-preview with Zoom */}
      <div 
        ref={containerRef} 
        style={{ 
          display: isRenderedDocx && !loading ? 'block' : 'none',
          width: '100%',
          maxWidth: '850px',
          margin: '0 auto',
          zoom: zoom,
          transform: typeof CSS !== 'undefined' && CSS.supports && CSS.supports('zoom', '1') ? 'none' : `scale(${zoom})`,
          transformOrigin: 'top center',
          transition: 'all 0.15s ease-out'
        }} 
      />

      {/* Container for backend extracted HTML (.doc format or fallback) with Zoom */}
      {htmlContent && !loading && (
        <div style={{
          backgroundColor: 'white',
          color: '#2d3748',
          width: '100%',
          maxWidth: '850px',
          minHeight: '800px',
          padding: '48px 56px',
          borderRadius: '6px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          fontFamily: "'Segoe UI', Calibri, Arial, sans-serif",
          fontSize: '15px',
          lineHeight: '1.6',
          boxSizing: 'border-box',
          overflowWrap: 'break-word',
          margin: '0 auto',
          zoom: zoom,
          transform: typeof CSS !== 'undefined' && CSS.supports && CSS.supports('zoom', '1') ? 'none' : `scale(${zoom})`,
          transformOrigin: 'top center',
          transition: 'all 0.15s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #2b579a', paddingBottom: '10px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                background: '#2b579a',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '0.75rem',
                padding: '3px 8px',
                borderRadius: '4px',
                letterSpacing: '0.5px'
              }}>
                {isDocxFormat ? 'DOCX' : 'DOC'}
              </span>
              <span style={{ fontSize: '0.95rem', color: '#334155', fontWeight: 600 }}>{fileName}</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Vista de lectura</span>
          </div>
          <div 
            dangerouslySetInnerHTML={{ __html: htmlContent }} 
            style={{ color: '#1e293b' }}
          />
        </div>
      )}

      {/* Floating Zoom Toolbar */}
      {!loading && !error && (
        <div style={{
          position: 'fixed',
          bottom: '36px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: 'rgba(30, 41, 59, 0.92)',
          backdropFilter: 'blur(8px)',
          padding: '6px 14px',
          borderRadius: '24px',
          boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
          color: 'white',
          zIndex: 10,
          userSelect: 'none'
        }}>
          <button
            type="button"
            onClick={() => updateZoom(prev => prev - 0.1)}
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: 'none',
              color: 'white',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s'
            }}
            title="Alejar (Ctrl -)"
          >
            <ZoomOut size={16} />
          </button>
          
          <button
            type="button"
            onClick={() => updateZoom(1)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#38bdf8',
              padding: '2px 8px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              minWidth: '50px',
              textAlign: 'center'
            }}
            title="Restablecer al 100%"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={() => updateZoom(prev => prev + 0.1)}
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: 'none',
              color: 'white',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s'
            }}
            title="Acercar (Ctrl +)"
          >
            <ZoomIn size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default WordDocumentViewer;
