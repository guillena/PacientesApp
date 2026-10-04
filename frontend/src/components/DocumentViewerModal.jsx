import React, { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Crop, Maximize2, Minimize2, X } from 'lucide-react';
import api from '../api';
import WordDocumentViewer from './WordDocumentViewer';
import ImageCropperModal from './ImageCropperModal';

const DocumentViewerModal = ({
  isOpen = true,
  doc,
  onClose,
  type = 'patient',
  zIndex = 1300,
  onCropSave
}) => {
  const [isDocMaximized, setIsDocMaximized] = useState(false);
  const [imgZoom, setImgZoom] = useState(1);
  const [docZoom, setDocZoom] = useState(1);
  const [imgRotation, setImgRotation] = useState(0);
  const [imgPan, setImgPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showCropper, setShowCropper] = useState(false);
  const [cropTimestamp, setCropTimestamp] = useState(Date.now());
  const [currentDoc, setCurrentDoc] = useState(doc);

  useEffect(() => {
    setCurrentDoc(doc);
    setIsDocMaximized(false);
    setImgZoom(1);
    setDocZoom(1);
    setImgRotation(0);
    setImgPan({ x: 0, y: 0 });
    setShowCropper(false);
    setCropTimestamp(Date.now());
  }, [doc]);

  if (!isOpen || !currentDoc) return null;

  const docUrl = currentDoc.url || currentDoc.fileUrl || '';
  const docName = currentDoc.originalName || docUrl || 'Documento';
  const isImage = !!docUrl.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);
  const isWord = !!(docUrl.toLowerCase().match(/\.(docx?)$/) || docName.toLowerCase().match(/\.(docx?)$/));
  const isPdf = docUrl.toLowerCase().endsWith('.pdf');

  const endpointBase = type === 'professional' ? 'professionals' : 'patients';
  const previewUrl = `${api.defaults.baseURL}/${endpointBase}/document/${currentDoc.id}/view?token=${localStorage.getItem('token')}&t=${cropTimestamp}`;

  const handleDownload = async () => {
    try {
      const response = await api.get(`/${endpointBase}/document/${currentDoc.id}/view?download=true`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] || 'application/octet-stream' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', currentDoc.originalName || 'documento');
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Error downloading document:', err);
    }
  };

  const handleSaveCrop = async (croppedBlob) => {
    try {
      const targetId = currentDoc.patientId || currentDoc.professionalId;
      const formData = new FormData();
      const fileName = currentDoc.originalName || 'recorte.jpg';
      formData.append('file', croppedBlob, fileName);

      let res;
      if (type === 'professional') {
        res = await api.post(`/professionals/${targetId}/documents/${currentDoc.id}/crop`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        res = await api.post(`/patients/${targetId}/documents/${currentDoc.id}/crop`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      const updated = res.data;
      setCurrentDoc(updated);
      setCropTimestamp(Date.now());
      setImgZoom(1);
      setImgRotation(0);
      setImgPan({ x: 0, y: 0 });
      setShowCropper(false);
      if (onCropSave) {
        onCropSave(updated);
      }
    } catch (err) {
      console.error('Error cropping document:', err);
    }
  };

  return (
    <>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', 
        justifyContent: 'center', alignItems: 'center', zIndex: zIndex, backdropFilter: 'blur(6px)'
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
              {docName}
            </h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {isImage && (
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
              {isWord && (
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
                onClick={handleDownload}
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
                onClick={onClose}
                style={{ background: '#fee2e2', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', color: '#ef4444' }}
                title="Cerrar"
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
              if (isImage) {
                return (
                  <img 
                    src={previewUrl} 
                    alt={docName} 
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
                  />
                );
              } 
              
              if (isPdf) {
                return (
                  <iframe 
                    src={previewUrl} 
                    style={{ width: '100%', height: '100%', border: 'none' }} 
                    title="PDF Preview"
                  />
                );
              } 

              if (isWord) {
                return (
                  <WordDocumentViewer 
                    fileUrl={docUrl}
                    fileName={docName}
                    docId={currentDoc.id}
                    type={type}
                    zoom={docZoom}
                    onZoomChange={setDocZoom}
                    onDownload={handleDownload}
                  />
                );
              } 

              return (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'white' }}>
                  <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📄</div>
                  <p style={{ fontSize: '1.1rem' }}>Vista previa no disponible para este tipo de archivo.</p>
                  <button 
                    className="btn btn-primary" 
                    onClick={handleDownload}
                    style={{ marginTop: '1.5rem' }}
                  >
                    Descargar para ver
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Image Cropper Modal */}
      {showCropper && currentDoc && (
        <ImageCropperModal
          isOpen={showCropper}
          imageUrl={previewUrl}
          fileName={currentDoc.originalName || 'recorte'}
          initialRotation={imgRotation}
          onSave={handleSaveCrop}
          onCancel={() => setShowCropper(false)}
        />
      )}
    </>
  );
};

export default DocumentViewerModal;
