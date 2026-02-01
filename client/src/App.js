import React, { useState } from 'react';
import RiderDashboard from './components/RiderDashboard';
import DriverPanel from './components/DriverPanel';
import './App.css';

function App() {
  const [view, setView] = useState('rider'); // 'rider' or 'driver'

  return (
    <div className="App">
      <header className="app-header">
        <h1 className="brand-title">🛺 IITK Connect</h1>
        
        <div className="nav-toggle">
          <button 
            className={`nav-btn ${view === 'rider' ? 'active' : ''}`} 
            onClick={() => setView('rider')}
          >
            Find a Ride
          </button>
          <button 
            className={`nav-btn ${view === 'driver' ? 'active' : ''}`} 
            onClick={() => setView('driver')}
          >
            Driver Mode
          </button>
        </div>
      </header>

      <main className="app-content">
        {view === 'rider' ? <RiderDashboard /> : <DriverPanel />}
      </main>
    </div>
  );
}

export default App;