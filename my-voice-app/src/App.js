import React, { useState } from 'react';
import { saveUserData, getUserData } from './firebaseUtils';

function App() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleStartCall = async () => {
    if (!name || !email) {
      setMessage('Please enter both name and email.');
      return;
    }

    try {
      const existingUser = await getUserData(email)

      if (existingUser) {
        setMessage(`Welcome back ${existingUser.name}!`)
      }
      else {
        await saveUserData(email, {
          name: name,
          email: email,
          past_conversations: [],
          documents_sent: [],
        });
        setMessage('User data saved successfully!');
      }

      
      
    } catch (error) {
      console.error('Error saving or accessing user data:', error);
      setMessage('Failed to start call.');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '400px', margin: 'auto' }}>
      <h1>Start Your Call</h1>

      <input
        type="text"
        placeholder="Enter your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
      />

      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
      />

      <button
        onClick={handleStartCall}
        style={{ width: '100%', padding: '0.75rem', backgroundColor: 'blue', color: 'white', border: 'none', cursor: 'pointer' }}
      >
        Start Call
      </button>

      {message && (
        <p style={{ marginTop: '1rem', color: message.includes('success') ? 'green' : 'red' }}>
          {message}
        </p>
      )}
    </div>
  );
}

export default App;