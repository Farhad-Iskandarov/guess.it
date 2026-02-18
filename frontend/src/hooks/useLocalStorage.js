import { useState, useEffect } from 'react';

export const useLocalStorage = (key, initialValue) => {
  // Get stored value or use initial value
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Update localStorage when value changes
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
};

// Hook to manage user votes
export const useVotes = () => {
  const [votes, setVotes] = useLocalStorage('guessit_votes', {});

  const addVote = (matchId, prediction) => {
    setVotes(prev => ({
      ...prev,
      [matchId]: {
        prediction,
        timestamp: new Date().toISOString()
      }
    }));
  };

  const removeVote = (matchId) => {
    setVotes(prev => {
      const newVotes = { ...prev };
      delete newVotes[matchId];
      return newVotes;
    });
  };

  const getVote = (matchId) => {
    return votes[matchId] || null;
  };

  const hasVoted = (matchId) => {
    return !!votes[matchId];
  };

  return { votes, addVote, removeVote, getVote, hasVoted };
};

export default useLocalStorage;
