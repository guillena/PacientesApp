import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import api from '../api';
import { useAuth } from '../store/AuthContext';
import { X, Trash2, CheckCircle2, CheckCheck } from 'lucide-react';
import MessageModal from '../components/MessageModal';

const Agenda = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  
  // Dependencies for dropdowns
  const [patients, setPatients] = useState([]);
  const [benefits, setBenefits] = useState([]);
  const [professionals, setProfessionals] = useState([]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteFuture, setDeleteFuture] = useState(false);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(false);
  const [filterProfessional, setFilterProfessional] = useState('all');
  const [formData, setFormData] = useState({
    patientId: '',
    benefitId: '',
    professionalId: '',
    date: '',
    startTime: '',
    endTime: '',
    notes: '',
    repetitions: 1,
    attended: false,
    confirmed: false
  });

  const [birthdayEvents, setBirthdayEvents] = useState([]);
  const [hoveredTooltip, setHoveredTooltip] = useState(null);

  useEffect(() => {
    fetchDependencies();
  }, [user.id]);

  useEffect(() => {
    fetchAppointments();
  }, [birthdayEvents]);

  const fetchDependencies = async () => {
    try {
      const [pts, bnts] = await Promise.all([
        api.get('/patients'),
        api.get('/benefits')
      ]);
      setPatients(pts.data);
      setBenefits(bnts.data);

      if (user.role === 'admin') {
        const profs = await api.get('/professionals');
        setProfessionals(profs.data);
      }

      const formatDate = (d) => d.toISOString().split('T')[0];
      const currentYear = new Date().getFullYear();

      const bdays = [];
      pts.data.forEach(p => {
        if (!p.birthDate || p.isInactive) return;
        const datePart = p.birthDate.split('T')[0];
        const [, month, day] = datePart.split('-');

        [currentYear, currentYear + 1].forEach(year => {
          // Use noon to avoid DST issues shifting the day
          const bdDate = new Date(`${year}-${month}-${day}T12:00:00`);
          const dow = bdDate.getDay(); // 0=Dom, 6=Sáb

          // Always push the actual birthday day (visible in month view)
          bdays.push({
            id: `bday-${p.id}-${year}`,
            title: `🎂 ${p.firstName} ${p.lastName}`,
            start: `${year}-${month}-${day}`,
            allDay: true,
            backgroundColor: '#f59e0b',
            borderColor: 'transparent',
            textColor: '#fff',
            extendedProps: { isBirthday: true, patient: p },
            display: 'block'
          });

          if (dow === 6 || dow === 0) {
            // Saturday (6) or Sunday (0)
            const dayLabel = dow === 6 ? 'sáb.' : 'dom.';

            // Friday before: arrow → (birthday coming this weekend)
            const friday = new Date(bdDate);
            friday.setDate(friday.getDate() - (dow === 6 ? 1 : 2));
            bdays.push({
              id: `bday-${p.id}-${year}-fri`,
              title: `🎂→ ${p.firstName} ${p.lastName} (${dayLabel})`,
              start: formatDate(friday),
              allDay: true,
              backgroundColor: '#f59e0b',
              borderColor: 'transparent',
              textColor: '#fff',
              extendedProps: { isBirthday: true, patient: p },
              display: 'block'
            });

            // Monday after: arrow ← (birthday was last weekend)
            const monday = new Date(bdDate);
            monday.setDate(monday.getDate() + (dow === 6 ? 2 : 1));
            bdays.push({
              id: `bday-${p.id}-${year}-mon`,
              title: `←🎂 ${p.firstName} ${p.lastName} (${dayLabel})`,
              start: formatDate(monday),
              allDay: true,
              backgroundColor: '#d97706',
              borderColor: 'transparent',
              textColor: '#fff',
              extendedProps: { isBirthday: true, patient: p },
              display: 'block'
            });
          }
        });
      });
      setBirthdayEvents(bdays);

    } catch (err) {
      console.error('Error fetching dependencies', err);
    }
  };

  const fetchAppointments = async () => {
    try {
      const [appRes, taskRes] = await Promise.all([
        api.get('/appointments'),
        api.get('/tasks')
      ]);

      const appEvents = appRes.data.map(app => ({
        id: app.id,
        title: `${app.Patient?.firstName} ${app.Patient?.lastName} - ${app.Benefit?.name}`,
        start: app.startTime,
        end: app.endTime,
        backgroundColor: (app.Benefit?.isAdmission || app.Professional?.role === 'admin') ? '#95a5a6' : (app.Professional?.color || 'var(--salmon)'),
        borderColor: 'transparent',
        extendedProps: { ...app },
        display: 'block'
      }));

      const taskEvents = taskRes.data
        .filter(t => t.date && t.status !== 'completa')
        .map(t => ({
          id: `task-${t.id}`,
          title: `📝 Tarea: ${t.description}`,
          start: t.date,
          allDay: true,
          backgroundColor: '#95a5a6',
          borderColor: 'transparent',
          extendedProps: { ...t, isTask: true },
          display: 'block'
        }));

      setEvents([...appEvents, ...taskEvents, ...birthdayEvents]);
    } catch (err) {
      console.error('Error fetching data', err);
    }
  };

  const handleDateClick = (arg) => {
    // Determine default end time (30 mins from click)
    const startDate = arg.date;
    const endDate = new Date(startDate.getTime() + 30 * 60000);

    const activePatients = patients.filter(p => !p.isInactive);

    setEditingId(null);
    setDeleteFuture(false);
    setFormData({
      patientId: activePatients.length > 0 ? activePatients[0].id : '',
      benefitId: benefits.length > 0 ? benefits[0].id : '',
      professionalId: user.role === 'admin' && professionals.length > 0 ? professionals[0].id : user.id,
      date: startDate.toISOString().split('T')[0],
      startTime: startDate.toTimeString().substring(0, 5),
      endTime: endDate.toTimeString().substring(0, 5),
      notes: '',
      repetitions: 1,
      attended: false,
      confirmed: false
    });
    setShowModal(true);
  };

  const handleEventClick = (info) => {
    if (info.event.extendedProps.isTask) return;
    if (info.event.extendedProps.isBirthday) return;
    const app = info.event.extendedProps;
    
    // Convert UTC Date to local HTML format for inputs
    const sDate = new Date(app.startTime);
    const eDate = new Date(app.endTime);

    setEditingId(app.id);
    setDeleteFuture(false);
    setFormData({
      patientId: app.patientId,
      benefitId: app.benefitId,
      professionalId: app.professionalId || user.id,
      date: sDate.toISOString().split('T')[0],
      startTime: sDate.toTimeString().substring(0, 5),
      endTime: eDate.toTimeString().substring(0, 5),
      notes: app.notes || '',
      repetitions: 1,
      attended: !!app.attended,
      confirmed: !!app.confirmed
    });
    setShowModal(true);
  };

  const handleEventMouseEnter = (info) => {
    const props = info.event.extendedProps;
    if (props.isTask || props.isBirthday) return;

    const rect = info.el.getBoundingClientRect();
    const bg = info.event.backgroundColor || 'var(--salmon)';

    const sDate = new Date(props.startTime);
    const eDate = new Date(props.endTime);
    const formatTime = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    setHoveredTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
      patientName: props.Patient ? `${props.Patient.firstName} ${props.Patient.lastName}` : 'Paciente',
      professionalName: props.Professional ? `${props.Professional.firstName} ${props.Professional.lastName}` : 'Profesional',
      timeStr: `${formatTime(sDate)} - ${formatTime(eDate)} hs`,
      confirmed: !!props.confirmed,
      attended: !!props.attended,
      backgroundColor: bg
    });
  };

  const handleEventMouseLeave = () => {
    setHoveredTooltip(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!formData.patientId || !formData.benefitId || !formData.date || !formData.startTime || !formData.endTime) {
        alert('Por favor, selecciona paciente, prestación, fecha y horarios.');
        return;
      }
      const reps = parseInt(formData.repetitions, 10) || 1;
      const promises = [];
      
      let repId = null;
      if (reps > 1) {
        const currentEvent = editingId ? events.find(e => e.id === editingId) : null;
        repId = currentEvent?.extendedProps?.repetitionId || (window.crypto ? window.crypto.randomUUID() : Math.random().toString(36).substring(2, 11));
      } else if (editingId) {
        // Keep existing repId if editing without adding more
        const currentEvent = events.find(e => e.id === editingId);
        repId = currentEvent?.extendedProps?.repetitionId;
      }

      for (let i = 0; i < reps; i++) {
        const currentStartDate = new Date(`${formData.date}T${formData.startTime}:00`);
        const currentEndDate = new Date(`${formData.date}T${formData.endTime}:00`);
        
        currentStartDate.setDate(currentStartDate.getDate() + (i * 7));
        currentEndDate.setDate(currentEndDate.getDate() + (i * 7));

        const startTimeISO = currentStartDate.toISOString();
        const endTimeISO = currentEndDate.toISOString();

        // Check if a session already exists for this patient, professional, and time
        const isDuplicate = events.some(ev => {
          const app = ev.extendedProps;
          if (app.isTask) return false;
          return ev.id !== editingId && 
                 app.patientId?.toString() === formData.patientId?.toString() &&
                 app.startTime === startTimeISO;
        });

        if (isDuplicate) {
          console.log(`Skipping duplicate session for ${startTimeISO}`);
          continue;
        }

        const payload = {
          patientId: formData.patientId,
          benefitId: formData.benefitId,
          professionalId: user.role === 'admin' ? formData.professionalId : user.id,
          startTime: startTimeISO,
          endTime: endTimeISO,
          notes: formData.notes,
          attended: formData.attended,
          confirmed: formData.confirmed,
          repetitionId: repId
        };

        if (editingId && i === 0) {
          promises.push(api.patch(`/appointments/${editingId}`, payload));
        } else {
          promises.push(api.post('/appointments', payload));
        }
      }

      await Promise.all(promises);

      setShowModal(false);
      fetchAppointments();
    } catch (err) {
      console.error('Submit error:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Error al guardar el turno.';
      alert(`Error: ${errorMsg}. Verifica que tengas los permisos necesarios.`);
    }
  };

  const handleDelete = () => {
    setConfirmDeleteModal(true);
  };

  const executeDelete = async () => {
    setConfirmDeleteModal(false);
    try {
      if (deleteFuture) {
        const currentApp = events.find(e => e.id === editingId)?.extendedProps;
        if (currentApp) {
          const currentStartDate = new Date(currentApp.startTime);
          const timeString = currentStartDate.toTimeString().substring(0, 5);
          const dayOfWeek = currentStartDate.getDay();
          
          const appsToDelete = events.filter(e => {
            const app = e.extendedProps;
            const appDate = new Date(app.startTime);
            
            // If they have the same repetitionId, use that
            if (currentApp.repetitionId && app.repetitionId === currentApp.repetitionId) {
              return appDate >= currentStartDate && !app.attended;
            }
            
            // Legacy fallback (fuzzy match)
            return app.patientId === currentApp.patientId &&
                   app.benefitId === currentApp.benefitId &&
                   app.professionalId === currentApp.professionalId &&
                   appDate >= currentStartDate &&
                   appDate.getDay() === dayOfWeek &&
                   appDate.toTimeString().substring(0, 5) === timeString &&
                   !app.attended;
          });
          
          const promises = appsToDelete.map(app => api.delete(`/appointments/${app.id}`));
          await Promise.all(promises);
        }
      } else {
        await api.delete(`/appointments/${editingId}`);
      }
      setShowModal(false);
      fetchAppointments();
    } catch (err) {
      alert('Error al eliminar el turno.');
    }
  };

  const displayEvents = filterProfessional === 'all' 
    ? events 
    : events.filter(e => e.extendedProps.isTask || e.extendedProps.isBirthday || e.extendedProps.professionalId?.toString() === filterProfessional.toString());

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>{user.role === 'admin' ? 'Agenda Global' : 'Mi Agenda'}</h1>
        
        {user.role === 'admin' && professionals.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <label style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#555' }}>Filtrar por profesional:</label>
            <select 
              value={filterProfessional}
              onChange={(e) => setFilterProfessional(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: 'white', minWidth: '200px', cursor: 'pointer' }}
            >
              <option value="all">Ver Todos</option>
              {professionals.map(p => (
                <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      
      <div className="card" style={{ padding: '2rem' }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="workWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,workWeek,timeGridDay'
          }}
          views={{
            workWeek: {
              type: 'timeGridWeek',
              hiddenDays: [0, 6],
              buttonText: 'Laboral'
            }
          }}
          events={displayEvents}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventMouseEnter={handleEventMouseEnter}
          eventMouseLeave={handleEventMouseLeave}
          slotMinTime="08:00:00"
          slotMaxTime="20:00:00"
          allDaySlot={true}
          slotEventOverlap={false}
          locale="es"
          buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', workWeek: 'Laboral', day: 'Día' }}
          eventBackgroundColor="var(--salmon)"
          eventBorderColor="transparent"
          height="700px"
          eventContent={(eventInfo) => {
            const isAttended = eventInfo.event.extendedProps.attended;
            const isConfirmed = eventInfo.event.extendedProps.confirmed;
            return (
              <div style={{ 
                padding: '2px 4px', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                width: '100%'
              }}>
                {isConfirmed && <CheckCheck size={14} style={{ flexShrink: 0, color: '#ffffff' }} title="Turno Confirmado" />}
                {isAttended && <CheckCircle2 size={14} style={{ flexShrink: 0 }} title="Asistió" />}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {eventInfo.event.title}
                </span>
              </div>
            );
          }}
        />
      </div>

      {hoveredTooltip && (
        <div 
          style={{
            position: 'fixed',
            top: hoveredTooltip.y,
            left: hoveredTooltip.x,
            transform: 'translate(-50%, -100%)',
            backgroundColor: hoveredTooltip.backgroundColor,
            color: '#ffffff',
            padding: '10px 14px',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            zIndex: 9999,
            pointerEvents: 'none',
            fontSize: '0.85rem',
            minWidth: '220px',
            border: '1px solid rgba(255,255,255,0.3)'
          }}
        >
          <div style={{ fontWeight: 'bold', fontSize: '0.95rem', marginBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.3)', paddingBottom: '4px' }}>
            👤 {hoveredTooltip.patientName}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div><strong>👨‍⚕️ Profesional:</strong> {hoveredTooltip.professionalName}</div>
            <div><strong>⏰ Horario:</strong> {hoveredTooltip.timeStr}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <strong>¿Confirmó?:</strong>
              {hoveredTooltip.confirmed ? (
                <span style={{ backgroundColor: 'rgba(255,255,255,0.25)', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                  <CheckCheck size={14} /> Sí
                </span>
              ) : (
                <span style={{ opacity: 0.85 }}>No</span>
              )}
            </div>
          </div>
          <div style={{
            position: 'absolute',
            bottom: '-6px',
            left: '50%',
            transform: 'translateX(-50%) rotate(45deg)',
            width: '12px',
            height: '12px',
            backgroundColor: hoveredTooltip.backgroundColor,
            borderRight: '1px solid rgba(255,255,255,0.3)',
            borderBottom: '1px solid rgba(255,255,255,0.3)'
          }} />
        </div>
      )}

      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', padding: '1.5rem' }}>
            <button onClick={() => setShowModal(false)} style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <X size={24} />
            </button>
            <h2 style={{ marginBottom: '1.2rem' }}>{editingId ? 'Editar Turno' : 'Nuevo Turno'}</h2>
            
            <form onSubmit={handleSubmit}>
              {/* Row 1: Paciente & Prestación */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Paciente</label>
                  <select 
                    className="form-control" 
                    value={formData.patientId} 
                    onChange={e => setFormData({...formData, patientId: e.target.value})} 
                    required
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: 'white' }}
                  >
                    <option value="" disabled>Seleccione un paciente</option>
                    {patients
                      .filter(p => !p.isInactive || p.id === formData.patientId)
                      .map(p => <option key={p.id} value={p.id}>{p.lastName}, {p.firstName}</option>)
                    }
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Prestación</label>
                  <select 
                    className="form-control" 
                    value={formData.benefitId} 
                    onChange={e => setFormData({...formData, benefitId: e.target.value})} 
                    required
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: 'white' }}
                  >
                    <option value="" disabled>Seleccione una prestación</option>
                    {benefits.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration} min)</option>)}
                  </select>
                </div>
              </div>

              {/* Row 2: Profesional Asignado & Repetir sesiones */}
              <div style={{ display: 'grid', gridTemplateColumns: user.role === 'admin' ? '1fr 1fr' : '1fr', gap: '1rem', marginBottom: '1rem' }}>
                {user.role === 'admin' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Profesional Asignado</label>
                    <select 
                      className="form-control" 
                      value={formData.professionalId} 
                      onChange={e => setFormData({...formData, professionalId: e.target.value})} 
                      required
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: 'white' }}
                    >
                      <option value="" disabled>Seleccione profesional</option>
                      {professionals.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Repetir sesiones</label>
                  <select 
                    value={formData.repetitions}
                    onChange={e => setFormData({...formData, repetitions: e.target.value})}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: 'white' }}
                  >
                    {[...Array(10)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1} {i === 0 ? 'vez' : 'sesiones semanales'}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Fecha, Inicio, Fin */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Fecha</label>
                  <input 
                    type="date" 
                    required 
                    value={formData.date} 
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Inicio</label>
                  <input 
                    type="time" 
                    required 
                    value={formData.startTime} 
                    onChange={e => setFormData({...formData, startTime: e.target.value})}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Fin</label>
                  <input 
                    type="time" 
                    required 
                    value={formData.endTime} 
                    onChange={e => setFormData({...formData, endTime: e.target.value})}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd' }}
                  />
                </div>
              </div>

              {/* Row 4: Status Checkboxes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ 
                  padding: '8px 12px', 
                  borderRadius: '8px', 
                  backgroundColor: '#f0fdf4', 
                  border: '1px solid #bbf7d0', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.8rem',
                  height: '42px'
                }}>
                  <input 
                    type="checkbox" 
                    id="confirmed"
                    checked={formData.confirmed}
                    onChange={(e) => setFormData({...formData, confirmed: e.target.checked})}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', margin: 0 }}
                  />
                  <label htmlFor="confirmed" style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#15803d', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', margin: 0 }}>
                    <CheckCheck size={16} /> ¿Confirmó?
                  </label>
                </div>

                <div style={{ 
                  padding: '8px 12px', 
                  borderRadius: '8px', 
                  backgroundColor: '#f0f9ff', 
                  border: '1px solid #bae6fd', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.8rem',
                  height: '42px'
                }}>
                  <input 
                    type="checkbox" 
                    id="attended"
                    checked={formData.attended}
                    onChange={(e) => setFormData({...formData, attended: e.target.checked})}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', margin: 0 }}
                  />
                  <label htmlFor="attended" style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#0369a1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', margin: 0 }}>
                    <CheckCircle2 size={16} /> ¿Asistió?
                  </label>
                </div>
              </div>

              {/* Row 5: Notes */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Notas</label>
                <textarea 
                  rows="2"
                  value={formData.notes} 
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd', resize: 'vertical' }}
                />
              </div>

              {editingId && (
                <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input 
                    type="checkbox" 
                    id="deleteFuture"
                    checked={deleteFuture}
                    onChange={(e) => setDeleteFuture(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label htmlFor="deleteFuture" style={{ fontSize: '0.9rem', color: '#666', cursor: 'pointer' }}>
                    Al eliminar, borrar también las sesiones repetidas futuras
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem' }}>
                {editingId && (
                  <button type="button" className="btn btn-secondary" onClick={handleDelete} style={{ background: '#ff4d4f', color: 'white', borderColor: '#ff4d4f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={18} />
                  </button>
                )}
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Guardar Turno</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <MessageModal 
        isOpen={confirmDeleteModal}
        type="info"
        message={deleteFuture 
          ? '¿Estás seguro de que deseas eliminar esta sesión y todas las sesiones repetidas futuras?' 
          : '¿Estás seguro de que deseas eliminar esta sesión?'}
        onClose={executeDelete}
        onCancel={() => setConfirmDeleteModal(false)}
      />

    </div>
  );
};

export default Agenda;
