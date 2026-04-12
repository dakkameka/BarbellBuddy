import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import './App.css';
import { getPostSessionDebrief, getLiveCoachMessage, getCalendarAdjustment, getNutritionAdvice, getChatCoachReply } from './openai';


import { useState } from 'react';
import HomePage from './pages/HomePage';
import CalendarPage from './pages/CalendarPage';
import NutritionPage from './pages/NutritionPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import './styles/globals.css';

function App() {
  const [screen, setScreen] = useState('home');

  return (
    <div className="app">
      <div className="topnav">
        <div className="logo">
          <span>Coach Nova</span>
        </div>

        <div className="nav-right">
          <button type="button" onClick={() => setScreen('home')}>Home</button>
          <button type="button" onClick={() => setScreen('calendar')}>Calendar</button>
          <button type="button" onClick={() => setScreen('nutrition')}>Nutrition</button>
          <button type="button" onClick={() => setScreen('chat')}>Coach</button>
          <button type="button" onClick={() => setScreen('profile')}>Profile</button>
        </div>
      </div>

      <div className="main-content">
        {screen === 'home' && <HomePage />}
        {screen === 'calendar' && <CalendarPage />}
        {screen === 'nutrition' && <NutritionPage />}
        {screen === 'chat' && <ChatPage />}
        {screen === 'profile' && <ProfilePage />}
      </div>
    </div>
  );
}

export default App;
