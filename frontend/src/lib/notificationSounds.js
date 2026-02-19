/**
 * Notification Sound System
 * Uses Web Audio API to generate subtle, modern notification tones
 * Different sounds per event type
 */

let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

function playTone(frequency, duration, type = 'sine', volume = 0.15, delay = 0) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime + delay);

    // Soft attack + decay envelope
    gain.gain.setValueAtTime(0, ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + delay + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
  } catch {
    // Silently fail if audio isn't available
  }
}

/**
 * New message received — soft double chime (ascending)
 */
export function playMessageSound() {
  playTone(880, 0.12, 'sine', 0.12, 0);
  playTone(1174, 0.15, 'sine', 0.10, 0.1);
}

/**
 * Friend request received — warm notification bell
 */
export function playFriendRequestSound() {
  playTone(659, 0.15, 'sine', 0.12, 0);
  playTone(784, 0.12, 'sine', 0.10, 0.12);
  playTone(988, 0.18, 'sine', 0.08, 0.22);
}

/**
 * Friend request accepted — cheerful ascending triple
 */
export function playFriendAcceptedSound() {
  playTone(523, 0.10, 'sine', 0.10, 0);
  playTone(659, 0.10, 'sine', 0.10, 0.10);
  playTone(784, 0.20, 'sine', 0.12, 0.20);
}

/**
 * Generic notification — single soft pop
 */
export function playNotificationSound() {
  playTone(740, 0.15, 'sine', 0.10, 0);
}

/**
 * Play sound by event type
 */
export function playSoundForEvent(eventType) {
  switch (eventType) {
    case 'new_message':
    case 'new_message_notification':
      playMessageSound();
      break;
    case 'friend_request':
    case 'friend_request_received':
      playFriendRequestSound();
      break;
    case 'friend_accepted':
    case 'friend_request_accepted':
      playFriendAcceptedSound();
      break;
    default:
      playNotificationSound();
  }
}
