import React, { use, useState } from 'react';
import { saveUserData, getUserData } from './firebaseUtils';

function App() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [chatMode, setChatMode] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [chatLog, setChatLog] = useState([]);

  const handleStartCall = async () => {
    if (!name || !email) {
      setMessage('Please enter both name and email.');
      return;
    }

    try {
      const existingUser = await getUserData(email)
      console.log("Existing user lookup:", existingUser);

      if (!existingUser) {
        console.log("Saving new user with email:", email);
        await saveUserData(email, {
          name: name,
          email: email,
          past_conversations: [],
          documents_sent: [],
        });
        setMessage(`Hi ${name}! How can I help you today?`);
        
      }
      else {
        setMessage(`Welcome back ${existingUser.name}! How can I help you today?`)
      }

      setChatMode(true);
      
    } catch (error) {
      console.error('Error saving or accessing user data:', error);
      setMessage('Failed to start call.');
    }
  };


  const handleSendMessage = async () => {
    if (!userInput.trim()) return;
  
    const newChatLog = [...chatLog, { sender: 'user', text: userInput }];
  
    try {
      // Send the message to Firebase function
      const response = await fetch('http://127.0.0.1:5001/ai-customer-service-fdd11/us-central1/chatWithAssistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userInput }),
      });
  
      const data = await response.json();
      const assistantResponse = data.reply;
  
      newChatLog.push({ sender: 'assistant', text: assistantResponse });
      setChatLog(newChatLog);
      setUserInput('');
    } catch (error) {
      console.error('Error talking to assistant:', error);
      newChatLog.push({ sender: 'assistant', text: "I'm having trouble responding right now." });
      setChatLog(newChatLog);
    }
  };  


  if (chatMode) {
    return (
      <div style={{ padding: '2rem', maxWidth: '600px', margin: 'auto' }}>
        <h1>Assistant Chat</h1>

        {message && (
        <p style={{ marginTop: '1rem', color: message.includes('success') ? 'green' : 'red' }}>
          {message}
        </p>
        )}

        <div style={{ border: '1px solid #ccc', padding: '1rem', height: '300px', overflowY: 'auto', marginBottom: '1rem' }}>
          {chatLog.map((entry, index) => (
            <div key={index} style={{ textAlign: entry.sender === 'user' ? 'right' : 'left', margin: '0.5rem 0' }}>
              <strong>{entry.sender === 'user' ? 'You' : 'Assistant'}:</strong> {entry.text}
            </div>
          ))}
        </div>

        <input
          type="text"
          placeholder="Type your message..."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
        />

        <button
          onClick={handleSendMessage}
          style={{ width: '100%', padding: '0.75rem', backgroundColor: 'green', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          Send
        </button>
      </div>
    );
  }

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