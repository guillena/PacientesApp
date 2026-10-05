import React, { useState, useEffect } from 'react';
import { useAuth } from '../store/AuthContext';
import { Calendar as CalendarIcon, Users, ArrowRight, CheckCircle2, Edit3, Trash2, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sendingMail, setSendingMail] = useState(false);

  const [stats, setStats] = useState({
    todayCount: 0,
    totalPatients: 0,
    nextAppointments: [],
  });
  const [tasks, setTasks] = useState([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskForm, setTaskForm] = useState({ description: '', status: 'pendiente', date: '' });
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [loading, setLoading] = useState(true);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [ptsRes, apptsRes, tasksRes] = await Promise.all([
          api.get('/patients'),
          api.get('/appointments'),
          api.get('/tasks')
        ]);

        setTasks(tasksRes.data);

        const patients = ptsRes.data;
        const appointments = apptsRes.data;

        const now = new Date();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        let todayCount = 0;
        let upcoming = [];

        appointments.forEach(app => {
          const apptDate = new Date(app.startTime);
          
          if (apptDate >= todayStart && apptDate <= todayEnd) {
            todayCount++;
          }
          if (apptDate >= now) {
            upcoming.push(app);
          }
        });

        upcoming.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
        
        setStats({
          todayCount,
          totalPatients: patients.filter(p => !p.isInactive).length,
          nextAppointments: upcoming.slice(0, 3)
        });

        // Compute birthdays
        const currentYear = now.getFullYear();
        const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayDayOfWeek = todayDate.getDay();

        const birthdays = [];
        patients.forEach(p => {
          if (!p.birthDate || p.isInactive) return;
          const datePart = p.birthDate.split('T')[0];
          const [birthYearStr, monthStr, dayStr] = datePart.split('-');
          const birthYear = parseInt(birthYearStr, 10);
          const month = parseInt(monthStr, 10);
          const day = parseInt(dayStr, 10);

          for (const year of [currentYear - 1, currentYear, currentYear + 1]) {
            const bdDate = new Date(year, month - 1, day);
            const bdDayOfWeek = bdDate.getDay();
            const diffDays = Math.round((bdDate - todayDate) / (1000 * 60 * 60 * 24));
            const age = year - birthYear;

            if (diffDays === 0) {
              birthdays.push({ patient: p, date: bdDate, age, isToday: true, displayLabel: 'Hoy 🎉' });
              break;
            }

            if (diffDays < 0) {
              if (todayDayOfWeek === 1 && (diffDays === -1 || diffDays === -2) && (bdDayOfWeek === 0 || bdDayOfWeek === 6)) {
                const dayTag = bdDayOfWeek === 6 ? 'sáb.' : 'dom.';
                const dateStr = bdDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
                birthdays.push({ patient: p, date: bdDate, age, isToday: false, displayLabel: `← ${dayTag} ${dateStr}` });
                break;
              }
              if (todayDayOfWeek === 0 && diffDays === -1 && bdDayOfWeek === 6) {
                const dateStr = bdDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
                birthdays.push({ patient: p, date: bdDate, age, isToday: false, displayLabel: `← sáb. ${dateStr}` });
                break;
              }
            }

            if (diffDays > 0 && diffDays <= 7) {
              const dateStr = bdDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

              if (todayDayOfWeek === 5 && (bdDayOfWeek === 6 || bdDayOfWeek === 0)) {
                const dayTag = bdDayOfWeek === 6 ? 'sáb.' : 'dom.';
                birthdays.push({ patient: p, date: bdDate, age, isToday: false, displayLabel: `→ ${dayTag} ${dateStr}` });
                break;
              }
              if (todayDayOfWeek === 6 && bdDayOfWeek === 0) {
                birthdays.push({ patient: p, date: bdDate, age, isToday: false, displayLabel: `→ dom. ${dateStr}` });
                break;
              }

              if (diffDays === 1) {
                birthdays.push({ patient: p, date: bdDate, age, isToday: false, displayLabel: 'Mañana' });
              } else {
                const dayName = bdDate.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
                birthdays.push({ patient: p, date: bdDate, age, isToday: false, displayLabel: dayName });
              }
              break;
            }
          }
        });

        birthdays.sort((a, b) => a.date - b.date);
        setUpcomingBirthdays(birthdays);

        setLoading(false);

      } catch (err) {
        console.error('Error fetching dashboard data', err);
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    if (!taskForm.description.trim()) return;
    
    setIsSavingTask(true);
    try {
      const payload = { ...taskForm };
      if (!payload.date) payload.date = null;
      
      if (editingTaskId) {
        await api.patch(`/tasks/${editingTaskId}`, payload);
      } else {
        await api.post('/tasks', payload);
      }
      
      setTaskForm({ description: '', status: 'pendiente', date: '' });
      setEditingTaskId(null);
      setIsAddingTask(false);
      
      // Refresh tasks
      const { data } = await api.get('/tasks');
      setTasks(data);
    } catch (err) { 
      console.error('Error saving task', err);
    } finally {
      setIsSavingTask(false);
    }
  };

  const handleToggleTaskStatus = async (task) => {
    const nextStatus = task.status === 'pendiente' ? 'en_ejecucion' : (task.status === 'en_ejecucion' ? 'completa' : 'pendiente');
    try {
      await api.patch(`/tasks/${task.id}`, { status: nextStatus });
      const { data } = await api.get('/tasks');
      setTasks(data);
    } catch (err) { console.error('Error updating task', err); }
  };

  const handleEditTask = (task) => {
    setEditingTaskId(task.id);
    setTaskForm({
      description: task.description,
      status: task.status,
      date: task.date || ''
    });
    setIsAddingTask(true);
  };

  const handleSendBirthdayEmail = async () => {
    setSendingMail(true);
    try {
      const res = await api.post('/patients/send-birthday-email');
      if (res.data.sent) {
        alert(`¡Correo enviado con éxito! Se notificaron los cumpleaños.`);
      } else {
        alert(res.data.message || 'No hay cumpleaños para notificar hoy.');
      }
    } catch (err) {
      console.error('Error enviando mail', err);
      const msg = err.response?.data?.error || err.message || 'Error al enviar mail. Revisa la configuración de SMTP en .env';
      alert(`Error al enviar mail: ${msg}`);
    } finally {
      setSendingMail(false);
    }
  };

  const handleDeleteTask = async (id) => {
    try {
      await api.delete(`/tasks/${id}`);
      const { data } = await api.get('/tasks');
      setTasks(data);
    } catch (err) { console.error('Error deleting task', err); }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completa': return '#059669';
      case 'en_ejecucion': return '#d97706';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (targetDate.getTime() === today.getTime()) {
      return 'Hoy';
    } else if (targetDate.getTime() === tomorrow.getTime()) {
      return 'Mañana';
    } else {
      const day = String(date.getDate()).padStart(2, '0');
      const month = date.toLocaleString('es-ES', { month: 'short' }).slice(0, 3);
      return `${day} ${month}`;
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
        <div style={{ 
          width: '50px', 
          height: '50px', 
          border: '5px solid #e0e0e0', /* slightly darker gray for contrast */
          borderTop: '5px solid var(--salmon)', 
          borderRadius: '50%', 
          animation: 'spin 1s linear infinite' 
        }} />
        <p style={{ marginTop: '1rem', fontWeight: 'bold', color: 'var(--dark-text)' }}>Cargando...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div>
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>
          Hola, {user?.firstName} 👋
        </h1>
        <p style={{ opacity: 0.7, fontSize: '1.2rem' }}>
          Bienvenido al portal de gestión de Kümespacio.
        </p>
      </header>

      {/* Summary Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '3rem'
      }}>
        <div className="card" style={{ borderLeft: '6px solid var(--salmon)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '4px' }}>Turnos para hoy</p>
              <h3 style={{ fontSize: '2rem' }}>{stats.todayCount}</h3>
            </div>
            <div style={{ background: 'var(--soft-gray)', padding: '12px', borderRadius: '12px' }}>
              <CalendarIcon color="var(--salmon)" />
            </div>
          </div>
        </div>

        <div className="card" style={{ borderLeft: '6px solid var(--light-blue)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '4px' }}>Pacientes Activos</p>
              <h3 style={{ fontSize: '2rem' }}>{stats.totalPatients}</h3>
            </div>
            <div style={{ background: 'var(--soft-gray)', padding: '12px', borderRadius: '12px' }}>
              <Users color="var(--light-blue)" />
            </div>
          </div>
        </div>

        <div className="card" style={{ borderLeft: '6px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '4px' }}>Cumpleaños (próx. 7 días)</p>
              <h3 style={{ fontSize: '2rem' }}>{upcomingBirthdays.length}</h3>
            </div>
            <div style={{ background: 'var(--soft-gray)', padding: '12px', borderRadius: '12px', fontSize: '1.6rem' }}>
              🎂
            </div>
          </div>
        </div>
      </div>

      {/* Next Appointments / Birthdays / Tasks */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '2rem' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h3>Próximos Turnos</h3>
            <button 
              className="btn" 
              style={{ background: 'transparent', color: 'var(--salmon)' }}
              onClick={() => navigate('/agenda')}
            >
              Ver todos <ArrowRight size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {stats.nextAppointments.length > 0 ? stats.nextAppointments.map((app) => (
              <div key={app.id} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                padding: '12px', 
                borderRadius: '12px',
                background: 'var(--soft-gray)'
              }}>
                <div style={{ 
                  width: '50px', 
                  height: '50px', 
                  background: 'white', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginRight: '1rem',
                  fontWeight: 'bold',
                  color: 'var(--salmon)'
                }}>
                  {new Date(app.startTime).getHours()}:{String(new Date(app.startTime).getMinutes()).padStart(2, '0')}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: '600' }}>{app.Patient?.firstName} {app.Patient?.lastName}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>{app.Benefit?.name}</p>
                    {app.attended && <CheckCircle2 size={14} color="#059669" />}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontWeight: '600' }}>{formatDate(app.startTime)}</p>
                  {user.role === 'admin' ? (
                    <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>Prof: {app.Professional?.firstName}</p>
                  ) : (
                    <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>{new Date(app.startTime).getHours()}:{String(new Date(app.startTime).getMinutes()).padStart(2, '0')}hs</p>
                  )}
                </div>
              </div>
            )) : (
              <p style={{ opacity: 0.6, textAlign: 'center', padding: '1rem' }}>No hay próximos turnos.</p>
            )}
          </div>
        </div>

        {/* Birthdays detail panel */}
        <div className="card" style={{ borderTop: '4px solid #f59e0b', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              🎂 Cumpleaños
            </h3>
            <button
              type="button"
              className="btn"
              onClick={handleSendBirthdayEmail}
              disabled={sendingMail}
              title="Enviar mail de aviso ahora a natafeli99@hotmail.com"
              style={{
                padding: '4px 8px',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: '#fffbeb',
                color: '#d97706',
                border: '1px solid #fde68a',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              <Mail size={14} /> {sendingMail ? 'Enviando...' : 'Notificar'}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            {upcomingBirthdays.length > 0 ? upcomingBirthdays.map(({ patient: p, age, isToday, displayLabel }) => {
              const hasArrow = displayLabel.includes('←') || displayLabel.includes('→');
              return (
                <div key={p.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', borderRadius: '10px',
                  background: isToday ? '#fffbeb' : 'var(--soft-gray)',
                  border: isToday ? '1px solid #f59e0b' : '1px solid transparent'
                }}>
                  <div>
                    <p style={{ fontWeight: '600', fontSize: '0.9rem', margin: 0 }}>{p.firstName} {p.lastName}</p>
                    <p style={{ fontSize: '0.75rem', opacity: 0.6, margin: 0 }}>Cumple {age} años</p>
                  </div>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: isToday ? 'bold' : 'normal',
                    color: isToday ? '#d97706' : (hasArrow ? '#d97706' : '#555')
                  }}>
                    {displayLabel}
                  </span>
                </div>
              );
            }) : (
              <p style={{ fontSize: '0.85rem', opacity: 0.5, textAlign: 'center', padding: '1rem' }}>
                Sin cumpleaños en los próximos 7 días.
              </p>
            )}
          </div>
        </div>

        <div className="card" style={{ background: 'white', color: 'var(--dark-text)', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={20} /> Tareas
            </h3>
            <button 
              className="btn" 
              style={{ padding: '4px 10px', fontSize: '0.8rem', background: isAddingTask ? 'var(--soft-gray)' : 'var(--primary)', color: isAddingTask ? 'var(--dark-text)' : 'white' }}
              onClick={() => {
                if (isAddingTask) {
                  setIsAddingTask(false);
                  setEditingTaskId(null);
                  setTaskForm({ description: '', status: 'pendiente', date: '' });
                } else {
                  setIsAddingTask(true);
                }
              }}
            >
              {isAddingTask ? 'Cancelar' : 'Nueva'}
            </button>
          </div>

          {isAddingTask && (
            <form onSubmit={handleTaskSubmit} style={{ marginBottom: '1.5rem', background: 'var(--soft-gray)', padding: '15px', borderRadius: '12px' }}>
              <div style={{ marginBottom: '0.8rem' }}>
                <textarea 
                  required
                  placeholder="Descripción de la tarea..."
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.9rem' }}
                  value={taskForm.description}
                  onChange={e => setTaskForm({...taskForm, description: e.target.value})}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '0.8rem' }}>
                <input 
                  type="date"
                  style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.8rem' }}
                  value={taskForm.date}
                  onChange={e => setTaskForm({...taskForm, date: e.target.value})}
                />
                <select 
                  style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.8rem', background: 'white' }}
                  value={taskForm.status}
                  onChange={e => setTaskForm({...taskForm, status: e.target.value})}
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="en_ejecucion">En Ejecución</option>
                  <option value="completa">Completa</option>
                </select>
              </div>
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '8px', fontSize: '0.9rem', opacity: isSavingTask ? 0.7 : 1 }}
                disabled={isSavingTask}
              >
                {isSavingTask ? 'Guardando...' : 'Guardar Tarea'}
              </button>
            </form>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '400px', overflowY: 'auto' }}>
            {tasks.length > 0 ? tasks.map(task => (
              <div key={task.id} style={{ 
                padding: '12px', 
                borderRadius: '10px', 
                border: '1px solid #eee', 
                background: task.status === 'completa' ? '#f3faf7' : '#fff',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ 
                    fontSize: '0.7rem', 
                    fontWeight: 'bold', 
                    textTransform: 'uppercase', 
                    color: getStatusColor(task.status)
                  }}>
                    {task.status.replace('_', ' ')}
                  </span>
                  {task.date && (
                    <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                      {formatDate(task.date)}
                    </span>
                  )}
                </div>
                <p 
                  onClick={() => handleEditTask(task)}
                  style={{ 
                    fontSize: '0.9rem', 
                    textDecoration: task.status === 'completa' ? 'line-through' : 'none',
                    opacity: task.status === 'completa' ? 0.6 : 1,
                    cursor: 'pointer',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.color = 'var(--primary)'}
                  onMouseLeave={(e) => e.target.style.color = 'inherit'}
                >
                  {task.description}
                </p>
                <div style={{ display: 'flex', gap: '15px', marginTop: '10px', alignItems: 'center' }}>
                  <button 
                    onClick={() => handleToggleTaskStatus(task)}
                    style={{ 
                      background: 'transparent', 
                      border: 'none', 
                      color: 'var(--primary)', 
                      fontSize: '0.75rem', 
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {task.status === 'completa' ? 'Reabrir' : 'Siguiente estado'}
                  </button>
                  <div style={{ flex: 1 }}></div>
                  <button 
                    onClick={() => handleEditTask(task)}
                    title="Editar"
                    style={{ 
                      background: 'transparent', 
                      border: 'none', 
                      color: '#666', 
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '4px',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
                    onMouseLeave={(e) => e.target.style.background = 'transparent'}
                  >
                    <Edit3 size={14} />
                  </button>
                  <button 
                    onClick={() => handleDeleteTask(task.id)}
                    title="Borrar"
                    style={{ 
                      background: 'transparent', 
                      border: 'none', 
                      color: '#ef4444', 
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '4px',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#fdf2f2'}
                    onMouseLeave={(e) => e.target.style.background = 'transparent'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )) : (
              <p style={{ fontSize: '0.85rem', opacity: 0.5, textAlign: 'center', padding: '1rem' }}>No hay tareas pendientes.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
