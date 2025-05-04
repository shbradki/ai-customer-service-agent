import React, { useState, useEffect } from 'react';
import { saveUserData, getUserData } from './firebaseUtils';
import { useMicVAD, utils } from '@ricky0123/vad-react';
import AdminDashboard from './AdminDashboard';

function App() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [chatMode, setChatMode] = useState(false);
  const [chatLog, setChatLog] = useState([]);
  const [showAdmin, setShowAdmin] = useState(false);
  const [topics, setTopics] = useState(new Set());
  const [documents, setDocuments] = useState(new Set());
  const [taskStack, setTaskStack] = useState(new Set());
  useEffect(() => {
    const hasPending = Array.from(taskStack).some(t => t.status === 'pending');
    if (hasPending) {
      executeTasks();
    }
  }, [taskStack]);

  const vad = useMicVAD({
    startOnLoad: false,
    onSpeechEnd: (audioBuffer) => {
      handleAudioCapture(audioBuffer);
    },
    positiveSpeechThreshold: 0.6,
    minSpeechFrames: 4,
  })

  function speakMessage(text) {
    return new Promise((resolve) => {
      vad.pause();
      const utterance = new SpeechSynthesisUtterance(text);
  
      window.speechSynthesis.speak(utterance);
  
      const checkIfDone = () => {
        if (!window.speechSynthesis.speaking) {
          vad.start();
          resolve();
        } else {
          setTimeout(checkIfDone, 100); 
        }
      };
  
      checkIfDone();
    });
  }
  
  
  function formatTopicList(topics) {
    if (!topics || topics.length === 0) return '';
    if (topics.length === 1) return topics[0];
    if (topics.length === 2) return `${topics[0]} and ${topics[1]}`;
    return `${topics.slice(0, -1).join(', ')} and ${topics[topics.length - 1]}`;
  }
  
  function cleanTopicList(topics) {
    const cleaned = new Set(
      Array.from(topics).map(t => t.trim().toLowerCase())
    );
    return Array.from(cleaned);
  }
  
  function cleanDocumentReferences(docs) {
    const cleaned = new Set(
      Array.from(docs).map(d => d.trim().toLowerCase())
    );
    return Array.from(cleaned);
  }

  async function executeTasks() {
    vad.pause()
    const pendingTasks = Array.from(taskStack).filter(t => t.status === 'pending');
  
    console.log("Inside of executeTasks()");
    console.log("TaskStack:", Array.from(taskStack));
    console.log("Pending tasks:", pendingTasks);
  
    const updatedTasks = new Set();
  
    for (const task of Array.from(taskStack)) {
      if (task.status === 'pending') {
        let message = '';
        switch (task.type) {
          case 'send_invoice':
            message = `Invoice ${task.document} has been sent to ${email}.`;
            break;
          case 'view_invoice':
            message = `You can view invoice ${task.document} at https://example.com/view/${task.document}`;
            break;
          case 'check_order_status':
            message = `The status of order ${task.order} is: Delivered.`;
            break;
          case 'reset_password':
            message = `You can reset your password here: https://example.com/reset_password`;
            break;
          default:
            message = `Simulated completion of unknown task: ${task.type}`;
            console.warn('Unknown task type:', task);
        }
        
        const msg = { sender: 'assistant', text: message };
        setChatLog(prev => [...prev, msg]);
        await speakMessage(message);

  
        updatedTasks.add({ ...task, status: 'completed' }); 
      } else {
        updatedTasks.add(task);
      }
    }
  
    setTaskStack(updatedTasks);
  }
  
  
  async function handleAudioCapture(audioBuffer) {
    const wav = utils.encodeWAV(audioBuffer);
    const audioBlob = new Blob([wav], { type: 'audio/wav'})

    try {
      const response = await fetch('http://127.0.0.1:5001/ai-customer-service-fdd11/us-central1/transcribeAudio', {
        method: 'POST',
        headers: {
          'Content-Type': 'audio/wav',
        },
        body: audioBlob,
      });

      const data = await response.json();
      const transcript = data.transcript;
      if (transcript) {
        sendTranscriptToAI(transcript)
      }
    } catch (error) {
      console.error('Error sending audio to Deepgram: ', error)
    }
  }

  async function sendTranscriptToAI(transcript) {

    const newChatLog = [...chatLog, { sender: 'user', text: transcript }];
  
    try {
      const response = await fetch('http://127.0.0.1:5001/ai-customer-service-fdd11/us-central1/processMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: transcript,
          chatLog: newChatLog,
          state: {
            topics: Array.from(topics),
            documents: Array.from(documents),
            tasks: Array.from(taskStack)
          }
        }),
      });
  
      const data = await response.json();
  
      // Merge topics
      if (data.topics) {
        setTopics(prev => new Set([...prev, ...data.topics]));
      }
  
      console.log('Response topics:', data.topics);

      
      
      // Merge document references
      if (data.document_references) {
        setDocuments(prev => new Set([...prev, ...data.document_references]));
      }
      
      console.log("Response tasks: ", data.tasks)

      // Merge task stacks
      if (data.tasks) {
        setTaskStack(prev => new Set([...prev, ...data.tasks]));
      }  
      
  
      // Append assistant reply to chat log
      newChatLog.push({ sender: 'assistant', text: data.assistantReply });
      setChatLog(newChatLog);
  
      await speakMessage(data.assistantReply);
      // await executeTasks();

    } catch (error) {
      console.error('Error talking to assistant:', error);
      newChatLog.push({ sender: 'assistant', text: "I'm having trouble responding right now." });
      setChatLog(newChatLog);
    }
  }

  const handleStartCall = async () => {
    if (!firstName || !lastName || !email) {
      setMessage('Please enter both name and email.');
      return;
    }
  
    try {
      const existingUser = await getUserData(email);
      console.log("Existing user lookup:", existingUser);
  
      let initialMessages = [];
  
      let greeting;

      if (!existingUser) {
        console.log("Saving new user with email:", email);
        await saveUserData(email, {
          first_name: firstName,
          last_name: lastName,
          email: email,
          past_conversations: [],
          documents_sent: [],
        });
  
        greeting = `Hi ${firstName}! How can I help you today?`
        initialMessages.push({
          sender: 'assistant',
          text: greeting,
        });

        
  
      } else {
        if (existingUser.past_conversations && existingUser.past_conversations.length > 0) {
          const lastConversation = existingUser.past_conversations[existingUser.past_conversations.length - 1];
          const lastTopics = lastConversation.topics;
          const formattedTopics = formatTopicList(lastTopics);

          greeting = `Hi ${existingUser.first_name}! Last time we discussed ${formattedTopics}. 
                            Is this call about that, or something new?`;

          initialMessages.push({
            sender: 'assistant',
            text: greeting,
          })

          

        } else {

          greeting = `Welcome back ${existingUser.first_name}! How can I help you today?`
          initialMessages.push({
            sender: 'assistant',
            text: greeting,
          });

          

        }
      }
  
      setChatLog(initialMessages);
      setChatMode(true);
  
      await speakMessage(greeting)

    } catch (error) {
      console.error('Error saving or accessing user data:', error);
      setMessage('Failed to start call.');
    }
  };
  

  const handleEndCall = async () => {
    try {
      vad.pause();

      const currentChat = [...chatLog];
      setChatLog([]);

      const hasUserMessage = currentChat.some(entry => entry.sender === 'user');
      if (!hasUserMessage) {
        console.log('No user messages. Skipping save.');
        setChatMode(false);
        return;
      }

      const userData = await getUserData(email);
      if (!userData) {
        setChatMode(false);
        return;
      }

      // Clean up sets before saving
      const cleanedTopics = cleanTopicList(topics);
      const cleanedDocuments = cleanDocumentReferences(documents);
      const finalizedTasks = Array.from(taskStack).map(t =>
        typeof t === 'string' ? JSON.parse(t) : t
      );

      const newConversation = {
        timestamp: new Date().toISOString(),
        chat: currentChat,
        topics: cleanedTopics,
        documents_referenced: cleanedDocuments,
        tasks: finalizedTasks,
      };

      const updatedConversations = [
        ...(userData.past_conversations || []),
        newConversation,
      ];

      await saveUserData(email, {
        ...userData,
        past_conversations: updatedConversations,
      });

      // Reset state
      setTopics(new Set());
      setDocuments(new Set());
      setTaskStack(new Set());
      setChatMode(false);
      setMessage('Call ended. You can start a new one if needed.');
      console.log('Conversation saved.');
    } catch (error) {
      console.error('Error saving conversation: ', error);
    }
  };
  

  if (chatMode) {
    return (
      <div style={{ padding: '2rem', maxWidth: '600px', margin: 'auto' }}>
        <h1>AI Voice Assistant</h1>
  
        <div style={{ border: '1px solid #ccc', padding: '1rem', height: '400px', overflowY: 'auto', marginBottom: '1rem' }}>
          {chatLog.map((entry, index) => (
            <div key={index} style={{ textAlign: entry.sender === 'user' ? 'right' : 'left', margin: '0.5rem 0' }}>
              <strong>{entry.sender === 'user' ? 'You' : 'Assistant'}:</strong> {entry.text}
            </div>
          ))}
        </div>
  
        {vad.listening ? (
          <p style={{ color: 'green' }}>Listening...</p>
        ) : vad.errored ? (
          <p style={{ color: 'red' }}>Microphone error. Please refresh.</p>
        ) : (
          <p style={{ color: 'gray' }}>Initializing microphone...</p>
        )}
        <button
          onClick={handleEndCall}
          style={{ width: '100%', padding: '0.75rem', backgroundColor: 'red', color: 'white', border: 'none', cursor: 'pointer', marginTop: '1rem' }}
        >
          End Call
        </button>


      </div>
    );
  }

  if (showAdmin) return <AdminDashboard onClose={() => setShowAdmin(false)} />;

  return (
    <div style={{ padding: '2rem', maxWidth: '400px', margin: 'auto' }}>
      <h1>Start Your Call</h1>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <input
          type="text"
          placeholder="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            marginBottom: '1rem',
          }}
        />
        <input
          type="text"
          placeholder="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            marginBottom: '1rem',
          }}
        />
      </div>


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

      <button
        onClick={() => setShowAdmin(true)}
        style={{ marginTop: '1rem', padding: '0.5rem', backgroundColor: 'gray', color: 'white' }}
      >
        View Admin Dashboard
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