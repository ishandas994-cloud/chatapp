import React, { useEffect, useRef, useState } from 'react';

const ICE = { iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]};

export default function CallUI({ callState, inCall, currentUser, socket, onClose }) {
  const localRef  = useRef(null);
  const remoteRef = useRef(null);
  const pcRef     = useRef(null);
  const streamRef = useRef(null);

  const [status,   setStatus]   = useState('connecting');
  const [muted,    setMuted]    = useState(false);
  const [camOff,   setCamOff]   = useState(false);
  const [duration, setDuration] = useState(0);
  const timerRef  = useRef(null);

  const isVideo  = (callState?.callType || inCall?.callType) === 'video';
  const targetId = callState?.targetId || inCall?.from;
  const name     = callState?.targetName || 'Caller';
  const isCaller = !!callState?.isCaller;

  useEffect(() => { init(); return cleanup; }, []); // eslint-disable-line

  useEffect(() => {
    const onAnswered = async ({ answer }) => {
      await pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
      setStatus('connected'); startTimer();
    };
    const onRejected = () => { setStatus('rejected'); setTimeout(onClose, 1500); };
    const onEnded    = () => { setStatus('ended');    setTimeout(onClose, 1000); };
    const onIce      = async ({ candidate }) => {
      try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    };

    socket.onCallAnswered(onAnswered);
    socket.onCallRejected(onRejected);
    socket.onCallEnded(onEnded);
    socket.onIce(onIce);

    return () => {
      socket.offCallAnswered(onAnswered);
      socket.offIce(onIce);
    };
  }, [socket]); // eslint-disable-line

  const init = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
      streamRef.current = stream;
      if (localRef.current) localRef.current.srcObject = stream;

      const pc = new RTCPeerConnection(ICE);
      pcRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.ontrack = (e) => { if (remoteRef.current) remoteRef.current.srcObject = e.streams[0]; };
      pc.onicecandidate = (e) => { if (e.candidate) socket.sendIce({ to: targetId, candidate: e.candidate }); };

      if (isCaller) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.initiateCall({ to: targetId, from: currentUser._id, callType: isVideo ? 'video' : 'audio', offer });
        setStatus('calling');
      } else {
        await pc.setRemoteDescription(new RTCSessionDescription(inCall.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.answerCall({ to: inCall.from, answer });
        setStatus('connected');
        startTimer();
      }
    } catch { setStatus('error'); }
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  };

  const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const cleanup = () => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
  };

  const hangUp = () => { socket.endCall({ to: targetId }); cleanup(); onClose(); };
  const reject = () => { socket.rejectCall({ to: targetId }); cleanup(); onClose(); };

  const toggleMute = () => {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMuted(m => !m);
  };

  const toggleCam = () => {
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCamOff(c => !c);
  };

  const labels = {
    connecting: 'Connecting…', calling: 'Calling…',
    connected: fmt(duration), rejected: 'Call declined',
    ended: 'Call ended', error: 'Could not connect',
  };

  return (
    <div className="call-overlay">
      {isVideo && status === 'connected' ? (
        <div className="call-videos">
          <video ref={remoteRef} autoPlay playsInline style={{ width:'min(70vw,640px)', height:'min(50vh,400px)' }} />
          <video ref={localRef}  autoPlay playsInline muted style={{ width:160, height:120 }} />
        </div>
      ) : (
        <>
          <div className="call-avatar-ring">👤</div>
          <h2>{name}</h2>
          <p>{labels[status]}</p>
        </>
      )}

      {!isVideo && <video ref={localRef}  autoPlay playsInline muted style={{ display:'none' }} />}
      {!isVideo && <video ref={remoteRef} autoPlay playsInline       style={{ display:'none' }} />}

      <div className="call-controls">
        <button className="call-btn mute" onClick={toggleMute}>{muted ? '🔇' : '🎙️'}</button>
        {isVideo && <button className="call-btn cam" onClick={toggleCam}>{camOff ? '📷' : '📹'}</button>}
        {(isCaller || status === 'connected')
          ? <button className="call-btn end"    onClick={hangUp}>📵</button>
          : <button className="call-btn reject" onClick={reject}>📵</button>
        }
        {!isCaller && status === 'connecting' && (
          <button className="call-btn answer" onClick={init}>📞</button>
        )}
      </div>
    </div>
  );
}