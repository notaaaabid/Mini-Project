import { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'peerjs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Video, Mic, MicOff, VideoOff, Phone, User, Paperclip, X, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface VideoCallProps {
    appointmentId: string;
    role: 'doctor' | 'patient';
    onEndCall: () => void;
}

const VideoCall = ({ appointmentId, role, onEndCall }: VideoCallProps) => {
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [status, setStatus] = useState<string>('Initializing...');
    const [isCallActive, setIsCallActive] = useState(false);
    const [myPeerId, setMyPeerId] = useState('');
    const [sharedFile, setSharedFile] = useState<{ url: string, type: string, name: string } | null>(null);

    const myVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Peer | null>(null);
    const callRef = useRef<any>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const dataConnRef = useRef<any>(null);
    const retryRef = useRef<NodeJS.Timeout | null>(null);
    const mountedRef = useRef(true);
    const connectedRef = useRef(false);
    const endedRef = useRef(false);

    // Deterministic peer IDs based on role + appointmentId
    const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9-_]/g, '_');
    const myPeerIdStr = sanitize(`appcall-${role}-${appointmentId}`);
    const targetPeerIdStr = sanitize(`appcall-${role === 'doctor' ? 'patient' : 'doctor'}-${appointmentId}`);

    // ─── Remote stream assignment ─────────────────────────────────────────────
    const onRemoteStream = useCallback((stream: MediaStream) => {
        if (!mountedRef.current) return;
        console.log('[VideoCall] ✅ Got remote stream:', stream.id);
        connectedRef.current = true;
        setRemoteStream(stream);
        setIsCallActive(true);
        setStatus('Connected');
        if (retryRef.current) { clearInterval(retryRef.current); retryRef.current = null; }
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
    }, []);

    // Keep remoteVideoRef in sync with remoteStream state
    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    // ─── Main init ────────────────────────────────────────────────────────────
    useEffect(() => {
        mountedRef.current = true;
        connectedRef.current = false;
        endedRef.current = false;

        const setupDataConnection = (conn: any) => {
            conn.on('data', (data: any) => {
                if (data.type === 'share-file') {
                    toast.success(`Participant shared a document.`);
                    setSharedFile(data.file);
                } else if (data.type === 'call-ended' && role === 'patient') {
                    toast.info('The consultation was concluded by the doctor.');
                    endCall();
                }
            });
            conn.on('error', (err: any) => console.error('[VideoCall] DataConn error:', err));
        };

        // ── Outbound retry loop (both roles call each other) ─────────────────
        const startCalling = () => {
            if (retryRef.current) clearInterval(retryRef.current);
            retryRef.current = setInterval(() => {
                if (connectedRef.current) {
                    if (retryRef.current) { clearInterval(retryRef.current); retryRef.current = null; }
                    return;
                }
                const peer = peerRef.current;
                if (peer && !peer.destroyed && peer.open) {
                    console.log(`[VideoCall] Attempting outbound call to ${targetPeerIdStr}...`);
                    tryCall(targetPeerIdStr);
                }
            }, 4000);
        };

        const tryCall = (remotePeerId: string) => {
            if (!mountedRef.current || connectedRef.current || !peerRef.current?.open) return;
            const localStream = streamRef.current;
            if (!localStream) { console.warn('[VideoCall] No localStream, aborting call attempt.'); return; }

            try {
                const call = peerRef.current.call(remotePeerId, localStream);
                if (!call) return;

                call.on('stream', (remoteStream: MediaStream) => {
                    console.log('[VideoCall] Outbound call → remote stream received:', remoteStream.id);
                    onRemoteStream(remoteStream);
                });
                call.on('close', () => {
                    console.log('[VideoCall] Outbound call closed.');
                    handleCallClosed();
                });
                call.on('error', (e: any) => console.error('[VideoCall] Outbound call error:', e));
                callRef.current = call;

                // Data channel (best-effort)
                try {
                    const conn = peerRef.current.connect(remotePeerId);
                    dataConnRef.current = conn;
                    setupDataConnection(conn);
                } catch { /* ignore */ }

            } catch (e) {
                console.error('[VideoCall] tryCall error:', e);
            }
        };

        // ── What to do when the active call closes ────────────────────────────
        // DOCTOR: keep peer alive, reset UI, restart listening for next patient call
        // PATIENT: will be re-created on next page visit / rejoin
        const handleCallClosed = () => {
            if (!mountedRef.current) return;
            console.log('[VideoCall] Call closed. Role:', role);
            connectedRef.current = false;
            setRemoteStream(null);
            setIsCallActive(false);
            setStatus(role === 'doctor' ? 'Waiting for patient to reconnect...' : 'Disconnected from doctor.');

            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

            // Close only the call object — DO NOT destroy the peer (especially for doctor)
            if (callRef.current) {
                try { callRef.current.close(); } catch { }
                callRef.current = null;
            }
            if (dataConnRef.current) {
                try { dataConnRef.current.close(); } catch { }
                dataConnRef.current = null;
            }

            // Restart outbound retry so both sides attempt to reconnect
            if (!endedRef.current) {
                startCalling();
            }
        };

        const init = async () => {
            try {
                // 1. Get local camera/mic
                console.log('[VideoCall] Requesting user media...');
                const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                console.log('[VideoCall] Got local stream:', localStream.id);

                if (!mountedRef.current) {
                    localStream.getTracks().forEach(t => t.stop());
                    return;
                }

                streamRef.current = localStream;

                // Bind local stream to the PiP video element (small self-preview)
                if (myVideoRef.current) {
                    myVideoRef.current.srcObject = localStream;
                    console.log('[VideoCall] Bound local stream to myVideoRef (PiP).');
                } else {
                    console.warn('[VideoCall] myVideoRef not ready during init.');
                }

                // 2. Create Peer with deterministic ID
                console.log('[VideoCall] Creating peer:', myPeerIdStr);
                const peer = new Peer(myPeerIdStr, {
                    config: {
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:stun1.l.google.com:19302' },
                            { urls: 'stun:stun2.l.google.com:19302' },
                            { urls: 'stun:global.stun.twilio.com:3478' }
                        ]
                    }
                });
                peerRef.current = peer;

                peer.on('open', (id) => {
                    if (!mountedRef.current) return;
                    console.log(`[VideoCall] Peer open: ${id}`);
                    setMyPeerId(id);
                    setStatus('Waiting for other party...');
                    // BOTH roles start calling — first to connect wins
                    startCalling();
                });

                // Accept incoming data connections
                peer.on('connection', (conn) => {
                    console.log('[VideoCall] Incoming data connection');
                    dataConnRef.current = conn;
                    setupDataConnection(conn);
                });

                // Accept incoming CALL (this is the doctor's primary way of receiving a patient)
                peer.on('call', (incomingCall) => {
                    if (!mountedRef.current) return;
                    const localStream = streamRef.current;
                    if (!localStream) {
                        console.error('[VideoCall] No localStream to answer incoming call!');
                        return;
                    }
                    console.log('[VideoCall] Answering incoming call from:', incomingCall.peer);
                    incomingCall.answer(localStream);

                    incomingCall.on('stream', (remoteStream: MediaStream) => {
                        console.log('[VideoCall] Incoming call → remote stream received:', remoteStream.id);
                        onRemoteStream(remoteStream);
                    });
                    incomingCall.on('close', () => {
                        console.log('[VideoCall] Incoming call closed.');
                        handleCallClosed();
                    });
                    incomingCall.on('error', (err: any) => console.error('[VideoCall] Incoming call error:', err));

                    callRef.current = incomingCall;
                });

                peer.on('error', (err) => {
                    console.error('[VideoCall] Peer error:', err.type, err);
                    if (!mountedRef.current) return;

                    if (err.type === 'unavailable-id') {
                        // Old session still occupying the ID — wait and retry
                        setStatus('Reconnecting (waiting for previous session to expire)...');
                        if (peerRef.current) { try { peerRef.current.destroy(); } catch { } peerRef.current = null; }
                        setTimeout(() => { if (mountedRef.current && !connectedRef.current) init(); }, 3000);
                    } else if (err.type !== 'peer-unavailable') {
                        // peer-unavailable is expected during retry — ignore it
                        setStatus('Connection error, retrying...');
                        setTimeout(() => { if (mountedRef.current && !connectedRef.current) init(); }, 5000);
                    }
                });

                peer.on('disconnected', () => {
                    if (mountedRef.current && peerRef.current && !peerRef.current.destroyed) {
                        console.log('[VideoCall] Peer disconnected from signaling, reconnecting...');
                        peerRef.current.reconnect();
                    }
                });

            } catch (err) {
                console.error('[VideoCall] Init error:', err);
                if (mountedRef.current) {
                    setStatus('Camera/Mic access denied.');
                    toast.error('Please grant camera and microphone permissions.');
                }
            }
        };

        init();

        return () => {
            mountedRef.current = false;
            if (retryRef.current) { clearInterval(retryRef.current); retryRef.current = null; }
            if (callRef.current) { try { callRef.current.close(); } catch { } }
            if (dataConnRef.current) { try { dataConnRef.current.close(); } catch { } }
            if (peerRef.current) { try { peerRef.current.destroy(); } catch { } peerRef.current = null; }
            if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
        };
    }, [appointmentId, role, myPeerIdStr, targetPeerIdStr, onRemoteStream]);

    // ─── BroadcastChannel: doctor-initiated end for patient ──────────────────
    useEffect(() => {
        const channel = new BroadcastChannel(`videocall-${appointmentId}`);
        channel.onmessage = (event) => {
            if (event.data.type === 'call-ended' && role === 'patient') {
                toast.info('The consultation was concluded by the doctor.');
                endCall();
            }
        };
        return () => channel.close();
    }, [appointmentId, role]);

    // ─── File Upload ──────────────────────────────────────────────────────────
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { toast.error('File too large. Max 5MB.'); return; }
        const reader = new FileReader();
        reader.onloadend = () => {
            const sharedData = {
                url: reader.result as string,
                type: file.type.includes('pdf') ? 'pdf' : 'image',
                name: file.name
            };
            setSharedFile(sharedData);
            if (dataConnRef.current?.open) {
                try { dataConnRef.current.send({ type: 'share-file', file: sharedData }); toast.success(`Shared ${file.name}`); }
                catch { toast.error('Failed to share file.'); }
            } else {
                toast.error('Not connected to peer yet.');
            }
        };
        reader.readAsDataURL(file);
    };

    // ─── Controls ─────────────────────────────────────────────────────────────
    const toggleMute = () => {
        streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
        setIsMuted(prev => !prev);
    };

    const toggleVideo = () => {
        streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
        setIsVideoOff(prev => !prev);
    };

    const endCall = () => {
        if (endedRef.current) return;
        endedRef.current = true;

        if (role === 'doctor') {
            // Doctor ends session for everyone
            try {
                if (dataConnRef.current?.open) {
                    dataConnRef.current.send({ type: 'call-ended', endedBy: role });
                }
                const channel = new BroadcastChannel(`videocall-${appointmentId}`);
                channel.postMessage({ type: 'call-ended', endedBy: role });
                channel.close();
            } catch { }
        }

        // Clean up
        if (retryRef.current) clearInterval(retryRef.current);
        if (callRef.current) { try { callRef.current.close(); } catch { } }
        if (peerRef.current) { try { peerRef.current.destroy(); } catch { } }
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());

        setIsCallActive(false);
        setRemoteStream(null);
        setSharedFile(null);
        onEndCall();
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <Card className="border-2 overflow-hidden h-full flex flex-col relative">
            <div className={cn("flex-1 min-h-0 bg-black flex", sharedFile ? "flex-row" : "flex-col")}>

                {/* ── Main section: remote video + PiP local video ── */}
                <div className={cn(
                    "relative flex-1 min-w-0 flex items-center justify-center bg-black",
                    sharedFile ? "w-1/2 border-r border-white/10" : "w-full"
                )}>
                    {/* REMOTE video — large, fills container */}
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                    />

                    {/* Waiting overlay when no remote stream yet */}
                    {!remoteStream && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 space-y-4 bg-black">
                            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center animate-pulse">
                                <User className="w-12 h-12" />
                            </div>
                            <p className="text-sm font-medium tracking-wide">{status}</p>
                        </div>
                    )}

                    {/* Remote user label */}
                    {remoteStream && (
                        <div className="absolute top-3 left-3 text-xs text-white/80 bg-black/50 px-2 py-1 rounded-md">
                            {role === 'doctor' ? 'Patient' : 'Doctor'}
                        </div>
                    )}

                    {/* LOCAL video — small PiP floating at bottom-right */}
                    <div className={cn(
                        "absolute bg-gray-900 rounded-xl border-2 border-white/30 overflow-hidden shadow-2xl z-10",
                        sharedFile ? "bottom-2 right-2 w-28 h-20" : "bottom-4 right-4 w-36 h-24"
                    )}>
                        <video
                            ref={myVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className={cn("w-full h-full object-cover", isVideoOff && "hidden")}
                        />
                        {isVideoOff && (
                            <div className="w-full h-full flex items-center justify-center bg-black">
                                <VideoOff className="w-6 h-6 text-white/50" />
                            </div>
                        )}
                        <div className="absolute bottom-1 left-2 text-[10px] text-white/80 bg-black/50 px-1 rounded">
                            You
                        </div>
                    </div>
                </div>

                {/* ── Shared document side panel ── */}
                {sharedFile && (
                    <div className="w-1/2 h-full bg-zinc-900 flex flex-col relative overflow-hidden">
                        <div className="flex justify-between items-center bg-zinc-800 p-2 sm:p-3 text-white border-b border-white/10 shrink-0">
                            <div className="flex items-center gap-2 truncate pr-2">
                                <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded uppercase font-semibold tracking-wide shrink-0">{sharedFile.type}</span>
                                <span className="font-medium text-sm truncate">{sharedFile.name}</span>
                            </div>
                            <Button variant="ghost" size="icon" className="hover:bg-white/10 h-7 w-7 text-white shrink-0" onClick={() => setSharedFile(null)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex-1 w-full bg-black/50 p-2 overflow-hidden flex items-center justify-center">
                            {sharedFile.type === 'pdf' ? (
                                <iframe src={`${sharedFile.url}#toolbar=0&navpanes=0`} className="w-full h-full bg-white rounded shadow-inner" title="PDF Document" />
                            ) : (
                                <img src={sharedFile.url} alt="Shared Document" className="max-w-full max-h-full object-contain rounded" />
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Controls ── */}
            <div className="p-4 bg-background border-t shrink-0 flex-none z-50">
                <div className="flex justify-center gap-4">
                    <Button
                        variant={isMuted ? "destructive" : "outline"}
                        size="icon"
                        className="rounded-full h-12 w-12"
                        onClick={toggleMute}
                    >
                        {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    </Button>

                    <Button
                        variant="destructive"
                        size="icon"
                        className="rounded-full h-12 w-12"
                        onClick={endCall}
                        title={role === 'doctor' ? 'End consultation' : 'Leave call'}
                    >
                        {role === 'doctor' ? <Phone className="h-5 w-5 rotate-[135deg]" /> : <LogOut className="h-5 w-5 ml-1" />}
                    </Button>

                    <Button
                        variant={isVideoOff ? "destructive" : "outline"}
                        size="icon"
                        className="rounded-full h-12 w-12"
                        onClick={toggleVideo}
                    >
                        {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                    </Button>

                    {role === 'patient' && (
                        <div className="relative">
                            <Button
                                variant="outline"
                                size="icon"
                                className="rounded-full h-12 w-12 hover:bg-muted"
                                title="Share Document (PDF/Image)"
                            >
                                <label htmlFor={`upload-${myPeerId || 'offline'}`} className="cursor-pointer flex items-center justify-center w-full h-full">
                                    <Paperclip className="h-5 w-5" />
                                </label>
                            </Button>
                            <input
                                type="file"
                                id={`upload-${myPeerId || 'offline'}`}
                                accept="application/pdf,image/*"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
};

export default VideoCall;
