import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

function AdminDashboard({ onClose }) {
  const [users, setUsers] = useState([]);
  const [topicCounts, setTopicCounts] = useState({});

  useEffect(() => {
    async function fetchUsers() {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);

      // Flatten and count all topics from past conversations
      const allTopics = usersData.flatMap(user =>
        user.past_conversations?.flatMap(conv => conv.topics || []) || []
      );

      const counts = {};
      for (const topic of allTopics) {
        if (topic) {
          const normalized = topic.trim().toLowerCase();
          counts[normalized] = (counts[normalized] || 0) + 1;
        }
      }

      setTopicCounts(counts);
    }

    fetchUsers();
  }, []);

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: 'auto' }}>
      <h1>Admin Dashboard</h1>
      <button
        onClick={onClose}
        style={{
          marginBottom: '1rem',
          padding: '0.5rem 1rem',
          backgroundColor: 'darkred',
          color: 'white',
          border: 'none',
          cursor: 'pointer'
        }}
      >
        Close Dashboard
      </button>

      <h2>Most Common Topics</h2>
      <ul>
        {Object.entries(topicCounts)
          .sort((a, b) => b[1] - a[1]) // sort by frequency
          .map(([topic, count]) => (
            <li key={topic}>
              {topic.charAt(0).toUpperCase() + topic.slice(1)} — {count} call{count !== 1 ? 's' : ''}
            </li>
          ))}
      </ul>

      <hr style={{ margin: '2rem 0' }} />

      {users.map(user => (
        <div key={user.id} style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '1rem' }}>
          <h2>{user.first_name} {user.last_name} ({user.email})</h2>

          {user.past_conversations && user.past_conversations.length > 0 ? (
            <ul>
              {user.past_conversations.map((conv, idx) => (
                <li key={idx}>
                  <strong>{new Date(conv.timestamp).toLocaleString()}:</strong>{' '}
                  {conv.topics && conv.topics.length > 0
                    ? conv.topics.join(', ')
                    : 'No topics found'}
                </li>
              ))}
            </ul>
          ) : (
            <p>No past conversations.</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default AdminDashboard;
