import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import './RiderDashboard.css';

function RiderDashboard() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // NEW: State to control the popup
  const [selectedDriver, setSelectedDriver] = useState(null);

  const fetchDrivers = async () => {
    try {
      const res = await axios.get(`${API_URL}/riders`);
      setDrivers(res.data);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching drivers:", err);
    }
  };

  useEffect(() => {
    fetchDrivers();
    const interval = setInterval(fetchDrivers, 5000);
    return () => clearInterval(interval);
  }, []);

  const groupedDrivers = drivers.reduce((groups, driver) => {
    const loc = driver.location || "Unknown Location";
    if (!groups[loc]) groups[loc] = [];
    groups[loc].push(driver);
    return groups;
  }, {});

  const getTimeAgo = (dateString) => {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    if (seconds < 60) return 'Just now';
    return `${Math.floor(seconds / 60)} min ago`;
  };

  return (
    <div className="rider-container">
      {loading ? (
        <div className="loading-spinner">Searching for autos...</div>
      ) : drivers.length === 0 ? (
        <div className="empty-state">
          <span style={{fontSize: '3rem'}}>😴</span>
          <h3>No drivers online</h3>
          <p>Drivers will appear here when they come online.</p>
        </div>
      ) : (
        Object.keys(groupedDrivers).map(location => (
          <div key={location} className="location-group">
            <h3 className="location-title">{location}</h3>
            <div className="driver-list">
              {groupedDrivers[location].map(d => (
                <div key={d._id} className="driver-card">
                  <div className="driver-info">
                    <div className="driver-name-row">
                      <strong>{d.name}</strong>
                      <span className="badge">{d.vehicleType || 'Auto'}</span>
                    </div>
                    <div className="driver-meta">
                      <span>{d.vehicleNumber}</span>
                      <span className="dot">•</span>
                      <span>{getTimeAgo(d.lastUpdated)}</span>
                    </div>
                  </div>
                  
                  {/* UPDATE: Button now opens popup instead of dialing */}
                  <button 
                    className="call-btn" 
                    onClick={() => setSelectedDriver(d)}
                  >
                    📞 Call
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* --- NEW: THE POPUP MODAL --- */}
      {selectedDriver && (
        <div className="modal-overlay" onClick={() => setSelectedDriver(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Contact Driver</h3>
            <p>You are about to call <strong>{selectedDriver.name}</strong></p>
            
            <div className="phone-display">
              {selectedDriver.phone}
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setSelectedDriver(null)}>
                Cancel
              </button>
              
              <a href={`tel:${selectedDriver.phone}`} className="btn-dial">
                Start Call
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RiderDashboard;