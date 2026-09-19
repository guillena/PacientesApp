require('./resolve-env');
require('dotenv').config();

const { Patient, PatientDocument, sequelize } = require('./src/models');
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

async function auditFiles() {
  console.log('=== AUDITORÍA DE ARCHIVOS DE PACIENTES (DB vs S3 / Local) ===\n');
  
  const bucketName = process.env.BUCKET_NAME || process.env.BUCKET;
  console.log(`- Bucket configurado: ${bucketName ? bucketName : 'NINGUNO (Modo Local)'}`);
  
  let s3 = null;
  if (bucketName) {
    s3 = new S3Client({
      region: process.env.REGION || 'us-east-1',
      endpoint: process.env.ENDPOINT,
      credentials: {
        accessKeyId: process.env.ACCESS_KEY_ID,
        secretAccessKey: process.env.SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  }

  const docs = await PatientDocument.findAll({
    include: [{ model: Patient }]
  });

  console.log(`- Total de documentos registrados en BD: ${docs.length}\n`);

  let missingInS3 = 0;
  let missingTotal = 0;
  let existsInS3Count = 0;
  let existsLocallyCount = 0;

  const results = [];

  for (const doc of docs) {
    const patientName = doc.Patient ? `${doc.Patient.firstName} ${doc.Patient.lastName}` : 'Desconocido';
    const docNumber = doc.Patient ? doc.Patient.docNumber : 'S/D';
    
    let key = '';
    let existsInS3 = false;
    let s3Error = null;

    if (doc.url.startsWith('http://') || doc.url.startsWith('https://')) {
      try {
        const urlObj = new URL(doc.url);
        key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
        if (bucketName && key.startsWith(`${bucketName}/`)) {
          key = key.substring(bucketName.length + 1);
        }
        if (key.startsWith('uploads/')) {
          key = key.substring('uploads/'.length);
        }
      } catch (e) {
        key = doc.url;
      }
    } else {
      key = doc.url;
    }

    // Check S3 if bucket is configured
    if (s3 && bucketName) {
      try {
        await s3.send(new HeadObjectCommand({
          Bucket: bucketName,
          Key: decodeURIComponent(key)
        }));
        existsInS3 = true;
        existsInS3Count++;
      } catch (err) {
        existsInS3 = false;
        s3Error = err.name || err.message;
      }
    }

    // Check local filesystem
    const relativeLocalPath = doc.url.replace(/^https?:\/\/[^\/]+/, '').replace(/^\/uploads\//, '').replace(/^uploads\//, '');
    const localPath = path.join(__dirname, 'uploads', relativeLocalPath);
    const existsLocally = fs.existsSync(localPath);
    if (existsLocally) existsLocallyCount++;

    const isMissingS3 = s3 && !existsInS3;
    if (isMissingS3) missingInS3++;

    if ((s3 && !existsInS3 && !existsLocally) || (!s3 && !existsLocally)) {
      missingTotal++;
    }

    results.push({
      docId: doc.id,
      patientName,
      docNumber,
      fileName: doc.originalName,
      url: doc.url,
      key,
      existsInS3,
      s3Error,
      existsLocally
    });
  }

  // Group and Display Missing Documents
  console.log('--------------------------------------------------------------------------------');
  console.log('📌 RESUMEN DE DOCUMENTOS FALTANTES EN EL BUCKET S3:');
  console.log('--------------------------------------------------------------------------------\n');

  const missingS3Docs = results.filter(r => s3 && !r.existsInS3);

  if (missingS3Docs.length === 0) {
    if (s3) {
      console.log('✅ ¡Excelente! Todos los documentos registrados en la BD existen en el Bucket S3.');
    } else {
      console.log('⚠️ No hay Bucket S3 configurado en las variables de entorno actuales.');
    }
  } else {
    console.log(`⚠️ Se encontraron ${missingS3Docs.length} documentos registrados en BD que NO están en S3:\n`);
    
    // Group by patient
    const byPatient = {};
    for (const item of missingS3Docs) {
      const pKey = `${item.patientName} (DNI: ${item.docNumber})`;
      if (!byPatient[pKey]) byPatient[pKey] = [];
      byPatient[pKey].push(item);
    }

    for (const [patientInfo, pDocs] of Object.entries(byPatient)) {
      console.log(`👤 Paciente: ${patientInfo}`);
      for (const d of pDocs) {
        console.log(`   📄 Documento: "${d.fileName}" (ID: ${d.docId})`);
        console.log(`      • Key buscada en S3: "${d.key}"`);
        console.log(`      • Error S3: ${d.s3Error}`);
        console.log(`      • ¿Existe en disco local /uploads?: ${d.existsLocally ? 'SÍ (se puede migrar)' : 'NO (archivo no encontrado)'}`);
        console.log(`      • URL en BD: ${d.url}`);
        console.log('');
      }
    }
  }

  console.log('--------------------------------------------------------------------------------');
  console.log(`MÉTRICAS TOTALES:`);
  console.log(`- Total registros en BD: ${docs.length}`);
  if (s3) {
    console.log(`- Presentes en S3: ${existsInS3Count}`);
    console.log(`- Faltantes en S3: ${missingInS3}`);
  }
  console.log(`- Presentes en disco local (/uploads): ${existsLocallyCount}`);
  console.log('--------------------------------------------------------------------------------');

  process.exit(0);
}

auditFiles().catch(err => {
  console.error('Error durante la auditoría:', err);
  process.exit(1);
});
