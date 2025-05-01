import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';


function AdminDashboard({ onClose }) {
  const [users, setUsers] = useState([]);
  const [summaryCounts, setSummaryCounts] = useState({});

  useEffect(() => {
    async function fetchUsers() {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
      // Flatten all summaries into one array
        const allSummaries = usersData.flatMap(user =>
            user.past_conversations?.map(conv => conv.summary) || []
        );
        
        // Count each summary
        const counts = {};
        for (const summary of allSummaries) {
            if (summary) {
            const lower = summary.toLowerCase(); // normalize
            counts[lower] = (counts[lower] || 0) + 1;
            }
        }
        
        setSummaryCounts(counts);
    
    }

    fetchUsers();
  }, []);

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: 'auto' }}>
      <h1>Admin Dashboard</h1>
      <button
        onClick={onClose}
        style={{ marginBottom: '1rem', padding: '0.5rem 1rem', backgroundColor: 'darkred', color: 'white', border: 'none', cursor: 'pointer' }}
        >
        Close Dashboard
      </button>


      <h2>Most Common Topics</h2>
        <ul>
        {Object.entries(summaryCounts)
            .sort((a, b) => b[1] - a[1]) // sort by frequency
            .map(([summary, count]) => (
            <li key={summary}>
                {summary.charAt(0).toUpperCase() + summary.slice(1)} — {count} call{count !== 1 ? 's' : ''}
            </li>
            ))}
        </ul>

      {users.map(user => (
        <div key={user.id} style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '1rem' }}>
          <h2>{user.name} ({user.email})</h2>

          {user.past_conversations && user.past_conversations.length > 0 ? (
            <ul>
              {user.past_conversations.map((conv, idx) => (
                <li key={idx}>
                  <strong>{new Date(conv.timestamp).toLocaleString()}:</strong> {conv.summary}
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
