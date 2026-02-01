import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import './DriverPanel.css';

function DriverPanel() {
  // --- STATE ---
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [driverName, setDriverName] = useState(localStorage.getItem('driverName') || '');
  const [phone, setPhone] = useState(localStorage.getItem('driverPhone') || ''); // Persist phone for updates
  
  const [view, setView] = useState('LOGIN'); // 'LOGIN', 'REGISTER', 'DASHBOARD'
  const [isEditing, setIsEditing] = useState(false); 
  const [status, setStatus] = useState('');

  // Form Inputs
  const [password, setPassword] = useState('');
  const [formData, setFormData] = useState({ name: '', vehicleType: 'Auto', vehicleNumber: '' });

  // --- EFFECT: Auto-redirect if logged in ---
  useEffect(() => {
    if (token) {
      setView('DASHBOARD');
    }
  }, [token]);

  // --- HELPER: Save Session ---
  const saveSession = (t, name, p) => {
    localStorage.setItem('token', t);
    localStorage.setItem('driverName', name);
    localStorage.setItem('driverPhone', p);
    setToken(t);
    setDriverName(name);
    setPhone(p);
  };

  // --- ACTION: Login ---
  const handleLogin = async () => {
    if (!phone || !password) { setStatus("Please enter phone and password."); return; }
    
    setStatus("Logging in...");
    try {
      const res = await axios.post(`${API_URL}/login`, { phone, password });
      const { token: newToken, driver } = res.data;

      saveSession(newToken, driver.name, driver.phone);
      setView('DASHBOARD');
      setStatus('');
    } catch (err) {
      console.error(err);
      setStatus(err.response?.data?.message || "Login Failed");
    }
  };

  // --- ACTION: Register ---
  const handleRegister = async () => {
    if (!phone || !password || !formData.name || !formData.vehicleNumber) {
      setStatus("Please fill all fields.");
      return;
    }

    setStatus("Registering...");
    try {
      const res = await axios.post(`${API_URL}/register`, { ...formData, phone, password });
      
      if (res.data.success) {
        const { token: newToken, driver } = res.data;
        saveSession(newToken, driver.name, driver.phone);
        setView('DASHBOARD'); 
        setStatus("Welcome to the team!");
      }
    } catch (err) {
      console.error(err);
      setStatus(err.response?.data?.message || "Registration Failed (Number exists?)");
    }
  };

  // --- ACTION: Edit Profile ---
  const startEditing = async () => {
    setStatus("Loading details...");
    try {
      // Use the cached phone number to fetch details
      const res = await axios.get(`${API_URL}/driver/${phone}`);
      if (res.data.exists) {
        const d = res.data.driver;
        setFormData({
          name: d.name,
          vehicleType: d.vehicleType,
          vehicleNumber: d.vehicleNumber
        });
        setIsEditing(true);
        setStatus("");
      }
    } catch (err) {
      setStatus("Could not load profile.");
    }
  };

  const handleSaveProfile = async () => {
    try {
      const res = await axios.put(`${API_URL}/driver/profile`, { ...formData, phone });
      if (res.data.success) {
        setDriverName(formData.name);
        localStorage.setItem('driverName', formData.name);
        setIsEditing(false);
        setStatus("Profile updated!");
      }
    } catch (err) {
      setStatus("Update failed.");
    }
  };

  // --- ACTION: Logout ---
  const handleLogout = () => {
    localStorage.clear();
    setToken('');
    setDriverName('');
    setPhone('');
    setView('LOGIN');
    setStatus('');
    setPassword('');
    setIsEditing(false);
  };

  // --- ACTION: Update Status (The main feature) ---
  const handleUpdate = async (code) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.post(`${API_URL}/update`, { code }, config);
      setStatus(res.data.message);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout();
        setStatus("Session expired.");
      } else {
        setStatus("Update Failed");
      }
    }
  };

  // --- VIEW 1: LOGIN ---
  if (view === 'LOGIN') {
    return (
      <div className="auth-box">
        <h3>🔐 Driver Login</h3>
        <input className="input-field" placeholder="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} />
        <input className="input-field" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <button className="btn btn-primary full-width" onClick={handleLogin}>Login</button>
        <p className="switch-text">New Driver? <span onClick={() => setView('REGISTER')} className="link">Register Here</span></p>
        <p className="error-text">{status}</p>
      </div>
    );
  }

  // --- VIEW 2: REGISTER OR EDIT ---
  if (view === 'REGISTER' || isEditing) {
    return (
      <div className="auth-box">
        <h3>{isEditing ? "✏️ Edit Profile" : "📝 Create Account"}</h3>
        
        <label>Full Name</label>
        <input className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
        
        <label>Phone Number {isEditing && "(Locked)"}</label>
        <input className="input-field" value={phone} onChange={e => setPhone(e.target.value)} disabled={isEditing} />
        
        {!isEditing && (
          <>
            <label>Password</label>
            <input className="input-field" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </>
        )}
        
        <div className="form-group">
            <label>Vehicle Type</label>
            <select className="input-field" value={formData.vehicleType} onChange={e => setFormData({...formData, vehicleType: e.target.value})}>
                <option value="Auto">Auto Rickshaw</option>
                <option value="Rickshaw">E-Rickshaw</option>
            </select>
        </div>

        <label>Vehicle Number</label>
        <input className="input-field" value={formData.vehicleNumber} onChange={e => setFormData({...formData, vehicleNumber: e.target.value})} />
        
        <div style={{display:'flex', gap:'10px'}}>
          <button className="btn btn-success full-width" onClick={isEditing ? handleSaveProfile : handleRegister}>
            {isEditing ? "Save" : "Register"}
          </button>
          {isEditing ? (
             <button className="btn btn-red full-width" onClick={() => setIsEditing(false)}>Cancel</button>
          ) : (
             <button className="btn btn-blue full-width" onClick={() => setView('LOGIN')}>Login instead</button>
          )}
        </div>
        
        <p className="error-text">{status}</p>
      </div>
    );
  }

  // --- VIEW 3: DASHBOARD ---
  return (
    <div className="dashboard-container">
      {/* HEADER CARD */}
      <div className="dashboard-header">
        <div>
          <span>Welcome,</span>
          <strong>{driverName}</strong>
          <div className="edit-link" onClick={startEditing}>
            <span>✎</span> Edit Profile
          </div>
        </div>
        <button onClick={handleLogout} className="btn-logout">Logout</button>
      </div>
      
      {/* STATUS SECTION */}
      <div className="section-title">Set Status</div>
      <div className="button-grid">
        <button onClick={() => handleUpdate('9')} className="btn btn-orange">
          <span>🔴</span> BUSY
        </button>
        <button onClick={() => handleUpdate('0')} className="btn btn-red">
          <span>❌</span> OFF DUTY
        </button>
      </div>

      {/* LOCATION SECTION */}
      <div className="section-title">Update Location</div>
      <div className="button-grid">
        <button onClick={() => handleUpdate('10')} className="btn btn-blue">📍 Main Gate</button>
        <button onClick={() => handleUpdate('11')} className="btn btn-blue">📍 Hall 1</button>
        <button onClick={() => handleUpdate('12')} className="btn btn-blue">📍 Hall 5</button>
        <button onClick={() => handleUpdate('11')} className="btn btn-blue">📍 Health Center</button>
        <button onClick={() => handleUpdate('14')} className="btn btn-blue">📍 Library</button>
        <button onClick={() => handleUpdate('15')} className="btn btn-blue">📍 Airstrip</button>
      </div>
      
      {/* TOAST MESSAGE */}
      {status && <div className="status-message">{status}</div>}
    </div>
  );
}

export default DriverPanel;