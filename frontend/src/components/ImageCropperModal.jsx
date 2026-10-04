import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactCrop, { centerCrop, convertToPixelCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Crop, RotateCw, Maximize, X, Check } from 'lucide-react';

// Helper to rotate an image element on canvas by given degrees (90, 180, 270)
const rotateImageElement = (imageElement, degrees = 90) => {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('No 2d context available');
      }

      const isSideways = degrees === 90 || degrees === 270;
      canvas.width = isSideways ? imageElement.naturalHeight : imageElement.naturalWidth;
      canvas.height = isSideways ? imageElement.naturalWidth : imageElement.naturalHeight;

      ctx.imageSmoothingQuality = 'high';
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((degrees * Math.PI) / 180);
      ctx.drawImage(imageElement, -imageElement.naturalWidth / 2, -imageElement.naturalHeight / 2);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas toBlob failed'));
          return;
        }
        resolve(blob);
      }, 'image/png');
    } catch (err) {
      reject(err);
    }
  });
};

const ImageCropperModal = ({ 
  isOpen, 
  imageUrl, 
  fileName = 'imagen', 
  initialRotation = 0,
  onSave, 
  onCancel 
}) => {
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [blobUrl, setBlobUrl] = useState('');
  const [loadingImage, setLoadingImage] = useState(true);
  const [isRotating, setIsRotating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aspect, setAspect] = useState(undefined); // undefined = freeform
  const imgRef = useRef(null);

  // Keep track of created ObjectURLs to revoke and prevent memory leaks
  const activeBlobUrlsRef = useRef([]);

  const registerBlobUrl = (url) => {
    if (url && url.startsWith('blob:')) {
      activeBlobUrlsRef.current.push(url);
    }
    return url;
  };

  const cleanupBlobUrls = () => {
    activeBlobUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        // ignore
      }
    });
    activeBlobUrlsRef.current = [];
  };

  // Load image as Blob URL to avoid CORS tainted canvas
  useEffect(() => {
    if (!isOpen || !imageUrl) return;

    let isMounted = true;
    setLoadingImage(true);
    setCrop(undefined);
    setCompletedCrop(null);
    setAspect(undefined);

    const loadImageBlob = async () => {
      try {
        const res = await fetch(imageUrl);
        if (!res.ok) throw new Error('Error al cargar la imagen');
        const blob = await res.blob();
        if (!isMounted) return;

        // If initialRotation is given (e.g. from viewer state), rotate before display
        const normalizedRot = ((initialRotation % 360) + 360) % 360;
        if (normalizedRot > 0) {
          const tempImg = new Image();
          const tempUrl = URL.createObjectURL(blob);
          registerBlobUrl(tempUrl);

          tempImg.onload = async () => {
            if (!isMounted) return;
            try {
              const rotatedBlob = await rotateImageElement(tempImg, normalizedRot);
              if (!isMounted) return;
              const rotatedUrl = registerBlobUrl(URL.createObjectURL(rotatedBlob));
              setBlobUrl(rotatedUrl);
            } catch {
              if (isMounted) setBlobUrl(tempUrl);
            } finally {
              if (isMounted) setLoadingImage(false);
            }
          };
          tempImg.onerror = () => {
            if (!isMounted) return;
            setBlobUrl(tempUrl);
            setLoadingImage(false);
          };
          tempImg.src = tempUrl;
        } else {
          const objectUrl = registerBlobUrl(URL.createObjectURL(blob));
          setBlobUrl(objectUrl);
          setLoadingImage(false);
        }
      } catch (err) {
        console.error('Error fetching image for cropper:', err);
        if (!isMounted) return;
        // Fallback to direct URL if fetch fails
        setBlobUrl(imageUrl);
        setLoadingImage(false);
      }
    };

    loadImageBlob();

    return () => {
      isMounted = false;
      cleanupBlobUrls();
    };
  }, [isOpen, imageUrl, initialRotation]);

  const onImageLoad = useCallback((e) => {
    const { width, height } = e.currentTarget;
    if (aspect) {
      const initial = centerCrop(
        makeAspectCrop({ unit: '%', width: 90 }, aspect, width, height),
        width,
        height
      );
      setCrop(initial);
      setCompletedCrop(convertToPixelCrop(initial, width, height));
    } else {
      const initial = centerCrop(
        convertToPixelCrop({ unit: '%', width: 90, height: 90, x: 5, y: 5 }, width, height),
        width,
        height
      );
      setCrop(initial);
      setCompletedCrop(initial);
    }
  }, [aspect]);

  const handleSelectAll = () => {
    if (!imgRef.current) return;
    const { width, height } = imgRef.current;
    const fullCrop = {
      unit: 'px',
      x: 0,
      y: 0,
      width,
      height
    };
    setCrop(fullCrop);
    setCompletedCrop(fullCrop);
    setAspect(undefined);
  };

  const handleRotate90 = async () => {
    const image = imgRef.current;
    if (!image || isRotating || saving) return;

    setIsRotating(true);
    try {
      const rotatedBlob = await rotateImageElement(image, 90);
      const newUrl = registerBlobUrl(URL.createObjectURL(rotatedBlob));
      setCrop(undefined);
      setCompletedCrop(null);
      setBlobUrl(newUrl);
    } catch (err) {
      console.error('Error rotating image:', err);
    } finally {
      setIsRotating(false);
    }
  };

  const handleAspectChange = (newAspect) => {
    setAspect(newAspect);
    if (!imgRef.current) return;
    const { width, height } = imgRef.current;
    if (newAspect) {
      const initial = centerCrop(
        makeAspectCrop({ unit: '%', width: 85 }, newAspect, width, height),
        width,
        height
      );
      setCrop(initial);
      setCompletedCrop(convertToPixelCrop(initial, width, height));
    }
  };

  const handleSaveCrop = async () => {
    const image = imgRef.current;
    if (!image || saving) return;

    setSaving(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No 2d context');

      const pixelCrop = completedCrop || {
        unit: 'px',
        x: 0,
        y: 0,
        width: image.width,
        height: image.height
      };

      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      const targetX = Math.max(0, Math.floor(pixelCrop.x * scaleX));
      const targetY = Math.max(0, Math.floor(pixelCrop.y * scaleY));
      const targetWidth = Math.min(
        image.naturalWidth - targetX,
        Math.floor(pixelCrop.width * scaleX)
      );
      const targetHeight = Math.min(
        image.naturalHeight - targetY,
        Math.floor(pixelCrop.height * scaleY)
      );

      canvas.width = Math.max(1, targetWidth);
      canvas.height = Math.max(1, targetHeight);

      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        image,
        targetX,
        targetY,
        targetWidth,
        targetHeight,
        0,
        0,
        targetWidth,
        targetHeight
      );

      // Determine mime type from filename
      const lower = fileName.toLowerCase();
      const mimeType = lower.endsWith('.png') ? 'image/png' : 'image/jpeg';
      const quality = mimeType === 'image/jpeg' ? 0.92 : undefined;

      canvas.toBlob(async (blob) => {
        if (!blob) {
          throw new Error('No se pudo generar el archivo de recorte');
        }
        try {
          await onSave(blob);
        } catch (err) {
          console.error('Error saving cropped blob:', err);
        } finally {
          setSaving(false);
        }
      }, mimeType, quality);
    } catch (err) {
      console.error('Crop error:', err);
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 1250,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '16px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        backgroundColor: '#1e293b',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '960px',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden',
        border: '1px solid #334155'
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0f172a',
          color: 'white',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#3b82f6', padding: '6px', borderRadius: '8px', display: 'flex' }}>
              <Crop size={18} color="white" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'white' }}>
                Recortar Imagen
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{fileName}</span>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Aspect Ratio Buttons */}
            <div style={{ display: 'flex', background: '#334155', borderRadius: '8px', padding: '2px' }}>
              <button
                type="button"
                onClick={() => handleAspectChange(undefined)}
                style={{
                  padding: '5px 10px',
                  background: aspect === undefined ? '#3b82f6' : 'transparent',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 500
                }}
                title="Proporción libre"
              >
                Libre
              </button>
              <button
                type="button"
                onClick={() => handleAspectChange(1)}
                style={{
                  padding: '5px 10px',
                  background: aspect === 1 ? '#3b82f6' : 'transparent',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 500
                }}
                title="Proporción cuadrada 1:1"
              >
                1:1
              </button>
              <button
                type="button"
                onClick={() => handleAspectChange(4 / 3)}
                style={{
                  padding: '5px 10px',
                  background: aspect === 4 / 3 ? '#3b82f6' : 'transparent',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 500
                }}
                title="Proporción 4:3"
              >
                4:3
              </button>
            </div>

            <button
              type="button"
              onClick={handleRotate90}
              disabled={saving || loadingImage || isRotating}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                background: '#334155',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: (saving || loadingImage || isRotating) ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500
              }}
              title="Girar 90 grados a la derecha"
            >
              <RotateCw size={15} style={{ animation: isRotating ? 'spin 0.6s linear infinite' : 'none' }} /> Girar 90°
            </button>

            <button
              type="button"
              onClick={handleSelectAll}
              disabled={saving || loadingImage || isRotating}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                background: '#334155',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500
              }}
              title="Seleccionar toda la imagen"
            >
              <Maximize size={15} /> Todo
            </button>

            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                background: '#475569',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500
              }}
            >
              <X size={16} /> Cancelar
            </button>

            <button
              type="button"
              onClick={handleSaveCrop}
              disabled={saving || loadingImage || isRotating}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 16px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: saving ? 'wait' : 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                opacity: saving ? 0.7 : 1
              }}
            >
              {saving ? (
                <>
                  <div style={{ width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Guardando...
                </>
              ) : (
                <>
                  <Check size={16} /> Guardar Recorte
                </>
              )}
            </button>
          </div>
        </div>

        {/* Crop Area */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px',
          background: '#090d16',
          minHeight: '400px'
        }}>
          {loadingImage ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#94a3b8', gap: '12px' }}>
              <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span>Cargando imagen para recorte...</span>
            </div>
          ) : (
            <div style={{ display: 'inline-block', maxWidth: '100%', maxHeight: '100%' }}>
              <ReactCrop
                crop={crop}
                aspect={aspect}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
              >
                <img
                  ref={imgRef}
                  alt="Recortar"
                  src={blobUrl}
                  style={{
                    maxHeight: '65vh',
                    maxWidth: '100%',
                    objectFit: 'contain',
                    display: 'block'
                  }}
                  onLoad={onImageLoad}
                />
              </ReactCrop>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div style={{
          padding: '10px 20px',
          backgroundColor: '#0f172a',
          borderTop: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.8rem',
          color: '#94a3b8'
        }}>
          <span>Arrastrá los bordes o esquinas para ajustar la zona de recorte.</span>
          {completedCrop && imgRef.current && (
            <span style={{ fontWeight: 500, color: '#38bdf8' }}>
              {Math.round(completedCrop.width * (imgRef.current.naturalWidth / imgRef.current.width))} × {Math.round(completedCrop.height * (imgRef.current.naturalHeight / imgRef.current.height))} px
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageCropperModal;
