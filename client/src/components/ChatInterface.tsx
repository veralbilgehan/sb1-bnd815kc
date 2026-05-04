import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Paperclip, File, Search, X, Download, Loader2, Camera, Image, Users, Plus, Trash2, UserPlus, ChevronLeft } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@/lib/auth";

interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  content: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileType: string | null;
  read: boolean;
  createdAt: string;
}

interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  content: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileType: string | null;
  createdAt: string;
}

interface ChatUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  department: string | null;
  avatar: string | null;
}

interface ChatGroup {
  id: string;
  name: string;
  companyId: string | null;
  createdBy: string | null;
  memberCount: number;
  createdAt: string;
}

interface ChatInterfaceProps {
  user: User;
}

type TabType = "kisiler" | "gruplar";

export default function ChatInterface({ user }: ChatInterfaceProps) {
  const { toast } = useToast();

  // Tab
  const [activeTab, setActiveTab] = useState<TabType>("kisiler");

  // Direct chat state
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [activeUser, setActiveUser] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Group chat state
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState<ChatGroup | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Shared state
  const [messageInput, setMessageInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const activeGroupIdRef = useRef<string | null>(null);

  // ─── User fetching ────────────────────────────────────────────────────────

  useEffect(() => {
    fetchUsers();
    fetchGroups();
    const interval = setInterval(() => { fetchUsers(); fetchGroups(); }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeUser) {
      const isNew = activeUser.id !== activeUserIdRef.current;
      activeUserIdRef.current = activeUser.id;
      fetchMessages(activeUser.id, isNew);
      const interval = setInterval(() => fetchMessages(activeUser.id, false), 3000);
      return () => clearInterval(interval);
    }
  }, [activeUser]);

  useEffect(() => {
    if (activeGroup) {
      const isNew = activeGroup.id !== activeGroupIdRef.current;
      activeGroupIdRef.current = activeGroup.id;
      fetchGroupMessages(activeGroup.id, isNew);
      const interval = setInterval(() => fetchGroupMessages(activeGroup.id, false), 3000);
      return () => clearInterval(interval);
    }
  }, [activeGroup]);

  useEffect(() => {
    return () => {
      if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
    };
  }, [cameraStream]);

  const fetchUsers = async (retry = true) => {
    let loaded = false;
    try {
      const res = await fetch("/api/conversations", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const others = data.users.filter((u: ChatUser) => u.id !== user.id);
        if (others.length > 0) {
          setUsers(others);
          setActiveUser(prev => prev ?? others[0]);
          loaded = true;
        }
      }
    } catch {}
    if (!loaded) {
      try {
        const res = await fetch("/api/users", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          const others = data.users.filter((u: ChatUser) => u.id !== user.id);
          if (others.length > 0) {
            setUsers(others);
            setActiveUser(prev => prev ?? others[0]);
            loaded = true;
          }
        }
      } catch (e) { console.error("Error fetching users:", e); }
    }
    if (!loaded && retry) setTimeout(() => fetchUsers(false), 3000);
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch("/api/groups", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
      }
    } catch (e) { console.error("Error fetching groups:", e); }
  };

  const fetchMessages = async (userId: string, scrollToBottom = false) => {
    try {
      const res = await fetch(`/api/messages/${userId}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
        if (scrollToBottom) setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    } catch (e) { console.error("Error fetching messages:", e); }
  };

  const fetchGroupMessages = async (groupId: string, scrollToBottom = false) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/messages`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setGroupMessages(data.messages);
        if (scrollToBottom) setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    } catch (e) { console.error("Error fetching group messages:", e); }
  };

  // ─── File handling ────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "Hata", description: "Dosya boyutu 10MB'dan büyük olamaz", variant: "destructive" });
        return;
      }
      setSelectedFile(file);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setCapturedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadFile = async (file: File) => {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Dosya okunamadı"));
      reader.readAsDataURL(file);
    });

    const res = await fetch("/api/upload-base64", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, name: file.name, type: file.type }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Dosya yüklenemedi (${res.status})`);
    }
    return res.json();
  };

  // ─── Camera ───────────────────────────────────────────────────────────────

  const startCamera = async () => {
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      setCameraStream(stream);
      setShowCamera(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
    } catch (error: any) {
      let message = "Kamera açılamadı";
      if (error.name === "NotAllowedError") message = "Kamera izni reddedildi.";
      else if (error.name === "NotFoundError") message = "Kamera bulunamadı";
      toast({ title: "Hata", description: message, variant: "destructive" });
    }
  };

  const stopCamera = useCallback(() => {
    if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); setCameraStream(null); }
    setShowCamera(false);
    setCapturedImage(null);
  }, [cameraStream]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        setCapturedImage(canvas.toDataURL("image/jpeg", 0.8));
        if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); setCameraStream(null); }
      }
    }
  };

  const useCapturedPhoto = async () => {
    if (capturedImage) {
      try {
        const res = await fetch(capturedImage);
        const blob = await res.blob();
        const file = new window.File([blob], `foto_${Date.now()}.jpg`, { type: "image/jpeg" });
        setSelectedFile(file);
        setShowCamera(false);
        setCapturedImage(null);
      } catch (e) { console.error("Error creating file:", e); }
    }
  };

  const retakePhoto = () => { setCapturedImage(null); startCamera(); };

  // ─── Send message ─────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (activeTab === "kisiler") {
      await handleSendDirect();
    } else {
      await handleSendGroup();
    }
  };

  const handleSendDirect = async () => {
    if (!activeUser) return;
    if (!messageInput.trim() && !selectedFile) return;
    setIsSending(true);
    try {
      let fileData = null;
      if (selectedFile) {
        setIsUploading(true);
        fileData = await uploadFile(selectedFile);
        setIsUploading(false);
      }
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          recipientId: activeUser.id,
          content: messageInput.trim() || null,
          fileUrl: fileData?.fileUrl || null,
          fileName: fileData?.fileName || null,
          fileSize: fileData?.fileSize || null,
          fileType: fileData?.fileType || null,
        }),
      });
      if (res.ok) {
        setMessageInput("");
        clearSelectedFile();
        await fetchMessages(activeUser.id, true);
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Mesaj gönderilemedi (${res.status})`);
      }
    } catch (error: any) {
      toast({ title: "Hata", description: error.message || "Mesaj gönderilemedi", variant: "destructive" });
    } finally {
      setIsSending(false);
      setIsUploading(false);
    }
  };

  const handleSendGroup = async () => {
    if (!activeGroup) return;
    if (!messageInput.trim() && !selectedFile) return;
    setIsSending(true);
    try {
      let fileData = null;
      if (selectedFile) {
        setIsUploading(true);
        fileData = await uploadFile(selectedFile);
        setIsUploading(false);
      }
      const res = await fetch(`/api/groups/${activeGroup.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content: messageInput.trim() || null,
          fileUrl: fileData?.fileUrl || null,
          fileName: fileData?.fileName || null,
          fileSize: fileData?.fileSize || null,
          fileType: fileData?.fileType || null,
        }),
      });
      if (res.ok) {
        setMessageInput("");
        clearSelectedFile();
        await fetchGroupMessages(activeGroup.id, true);
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Mesaj gönderilemedi (${res.status})`);
      }
    } catch (error: any) {
      toast({ title: "Hata", description: error.message || "Mesaj gönderilemedi", variant: "destructive" });
    } finally {
      setIsSending(false);
      setIsUploading(false);
    }
  };

  // ─── Create group ─────────────────────────────────────────────────────────

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast({ title: "Hata", description: "Grup adı gerekli", variant: "destructive" });
      return;
    }
    setIsCreatingGroup(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newGroupName.trim(), memberIds: selectedMemberIds }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: "Başarılı", description: `"${newGroupName}" grubu oluşturuldu` });
        setNewGroupName("");
        setSelectedMemberIds([]);
        setShowCreateGroup(false);
        await fetchGroups();
        setActiveGroup({ ...data.group, memberCount: selectedMemberIds.length + 1 });
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Grup oluşturulamadı");
      }
    } catch (error: any) {
      toast({ title: "Hata", description: error.message || "Grup oluşturulamadı", variant: "destructive" });
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!confirm(`"${groupName}" grubunu silmek istediğinizden emin misiniz?`)) return;
    try {
      const res = await fetch(`/api/groups/${groupId}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        toast({ title: "Başarılı", description: "Grup silindi" });
        setActiveGroup(null);
        await fetchGroups();
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Grup silinemedi");
      }
    } catch (error: any) {
      toast({ title: "Hata", description: error.message, variant: "destructive" });
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const isImageFile = (type: string | null) => type?.startsWith("image/");

  const filteredUsers = users.filter(u =>
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isManager = user.role === "manager" || user.role === "super_admin";

  // User lookup map for group messages
  const userMap = new Map<string, ChatUser>(users.map(u => [u.id, u]));

  // ─── Message bubble (shared) ──────────────────────────────────────────────

  const renderFileBubble = (msg: Message | GroupMessage, isOwn: boolean) => (
    <>
      {msg.fileUrl && (
        isImageFile(msg.fileType) ? (
          <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="block mb-2">
            <img src={msg.fileUrl} alt={msg.fileName || "Fotoğraf"} className="max-w-full rounded-lg max-h-48 object-cover" />
          </a>
        ) : (
          <a
            href={msg.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn("flex items-center gap-3 p-2 rounded-lg mb-2", isOwn ? "bg-primary-foreground/10" : "bg-slate-100")}
          >
            <div className={cn("p-2 rounded", isOwn ? "bg-primary-foreground/20" : "bg-slate-200")}>
              <File className={cn("h-6 w-6", isOwn ? "text-primary-foreground" : "text-blue-500")} />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className={cn("font-medium text-sm truncate", isOwn ? "text-primary-foreground" : "text-slate-800")}>{msg.fileName}</p>
              <p className={cn("text-xs", isOwn ? "text-primary-foreground/70" : "text-slate-500")}>
                {msg.fileSize ? formatFileSize(msg.fileSize) : ""}
              </p>
            </div>
            <Download className={cn("h-4 w-4", isOwn ? "text-primary-foreground" : "text-blue-500")} />
          </a>
        )
      )}
      {msg.content && <p className="text-sm">{msg.content}</p>}
    </>
  );

  // ─── Message input bar (shared) ───────────────────────────────────────────

  const renderInputBar = () => (
    <div className="sticky bottom-0 z-10 border-t bg-white/95 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] backdrop-blur shrink-0">
      {selectedFile && (
        <div className="mb-2 px-2 py-2 bg-blue-50 rounded-lg flex items-center gap-2">
          {selectedFile.type.startsWith("image/") ? (
            <Image className="h-4 w-4 text-blue-500 shrink-0" />
          ) : (
            <File className="h-4 w-4 text-blue-500 shrink-0" />
          )}
          <span className="text-xs font-medium truncate flex-1">{selectedFile.name}</span>
          <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(selectedFile.size)}</span>
          <Button variant="ghost" size="icon" onClick={clearSelectedFile} className="h-6 w-6 shrink-0" data-testid="button-clear-file">
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
      <div className="flex items-center gap-1">
        <label
          htmlFor="chat-file-input"
          className={`inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground shrink-0 cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors ${isSending ? "opacity-50 pointer-events-none" : ""}`}
          data-testid="button-attach-file"
        >
          <Paperclip className="h-4 w-4" />
        </label>
        <Button variant="ghost" size="icon" className="text-muted-foreground shrink-0 h-8 w-8" onClick={startCamera} disabled={isSending} data-testid="button-open-camera">
          <Camera className="h-4 w-4" />
        </Button>
        <Input
          value={messageInput}
          onChange={e => setMessageInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Mesaj yazın..."
          className="flex-1 min-w-0 rounded-full bg-slate-50 border-slate-200 text-sm h-8"
          disabled={isSending}
          data-testid="input-message"
        />
        <Button
          onClick={handleSend}
          size="icon"
          className="rounded-full h-8 w-8 shrink-0 bg-primary"
          disabled={isSending || (!messageInput.trim() && !selectedFile)}
          data-testid="button-send-message"
        >
          {isSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
        </Button>
      </div>
      {isUploading && <p className="text-xs text-muted-foreground text-center mt-1">Dosya yükleniyor...</p>}
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-0 flex-col bg-white overflow-hidden relative md:flex-row md:min-h-[calc(100vh-9rem)]">
      <canvas ref={canvasRef} className="hidden" />
      <input
        id="chat-file-input"
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        disabled={isSending}
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        data-testid="input-file"
      />

      {/* Camera Modal */}
      {showCamera && (
        <div className="absolute inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between p-3 bg-black/80">
            <h3 className="text-white font-medium text-sm">Fotoğraf Çek</h3>
            <Button variant="ghost" size="icon" onClick={stopCamera} className="text-white hover:bg-white/20 h-8 w-8" data-testid="button-close-camera">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            {capturedImage ? (
              <img src={capturedImage} alt="Çekilen fotoğraf" className="max-w-full max-h-full object-contain" />
            ) : (
              <video ref={videoRef} autoPlay playsInline muted className="max-w-full max-h-full object-contain" />
            )}
          </div>
          <div className="p-4 bg-black/80 flex items-center justify-center gap-4">
            {capturedImage ? (
              <>
                <Button variant="outline" onClick={retakePhoto} className="bg-white/10 text-white border-white/30 hover:bg-white/20" data-testid="button-retake-photo">
                  <Camera className="mr-2 h-4 w-4" /> Tekrar Çek
                </Button>
                <Button onClick={useCapturedPhoto} className="bg-primary" data-testid="button-use-photo">
                  <Send className="mr-2 h-4 w-4" /> Kullan
                </Button>
              </>
            ) : (
              <Button onClick={capturePhoto} size="lg" className="rounded-full h-14 w-14 bg-white hover:bg-gray-200" data-testid="button-capture-photo">
                <Camera className="h-6 w-6 text-black" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="absolute inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-base">Yeni Grup Oluştur</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowCreateGroup(false)} className="h-7 w-7">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 flex flex-col gap-3 overflow-y-auto flex-1">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Grup Adı</label>
                <Input
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="Örn: Satış Ekibi"
                  data-testid="input-group-name"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Üyeler <span className="text-muted-foreground font-normal">({selectedMemberIds.length} seçildi)</span>
                </label>
                <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  {users.map(u => (
                    <label
                      key={u.id}
                      className="flex items-center gap-3 p-2.5 hover:bg-slate-50 cursor-pointer border-b last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMemberIds.includes(u.id)}
                        onChange={e => {
                          if (e.target.checked) setSelectedMemberIds(prev => [...prev, u.id]);
                          else setSelectedMemberIds(prev => prev.filter(id => id !== u.id));
                        }}
                        className="accent-blue-600"
                      />
                      <div>
                        <p className="text-sm font-medium">{u.fullName}</p>
                        <p className="text-xs text-muted-foreground">{u.department || u.role}</p>
                      </div>
                    </label>
                  ))}
                  {users.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Kullanıcı bulunamadı</p>}
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreateGroup(false)}>İptal</Button>
              <Button className="flex-1" onClick={handleCreateGroup} disabled={isCreatingGroup || !newGroupName.trim()} data-testid="button-create-group">
                {isCreatingGroup ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Oluştur
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="flex w-full max-h-[38vh] flex-col overflow-hidden border-b bg-slate-50 shrink-0 md:h-full md:max-h-none md:w-1/4 md:border-b-0 md:border-r">
        {/* Tabs */}
        <div className="flex border-b bg-white">
          <button
            onClick={() => setActiveTab("kisiler")}
            className={cn("flex-1 py-2.5 text-xs font-medium transition-colors", activeTab === "kisiler" ? "text-primary border-b-2 border-primary bg-blue-50" : "text-muted-foreground hover:text-slate-700")}
            data-testid="tab-kisiler"
          >
            Kişiler
          </button>
          <button
            onClick={() => setActiveTab("gruplar")}
            className={cn("flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1", activeTab === "gruplar" ? "text-primary border-b-2 border-primary bg-blue-50" : "text-muted-foreground hover:text-slate-700")}
            data-testid="tab-gruplar"
          >
            <Users className="h-3 w-3" /> Gruplar
            {groups.length > 0 && <span className="bg-primary text-primary-foreground text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{groups.length}</span>}
          </button>
        </div>

        {/* Search */}
        <div className="p-2 border-b bg-white">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={activeTab === "kisiler" ? "Kişi ara..." : "Grup ara..."}
              className="pl-7 bg-slate-50 h-8 text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              data-testid="input-search"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {activeTab === "kisiler" ? (
            <>
              {filteredUsers.map(chatUser => (
                <div
                  key={chatUser.id}
                  onClick={() => setActiveUser(chatUser)}
                  className={cn("p-3 cursor-pointer hover:bg-slate-100 transition-colors border-b border-slate-100", activeUser?.id === chatUser.id && "bg-blue-50 hover:bg-blue-50")}
                  data-testid={`user-${chatUser.id}`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm truncate">{chatUser.fullName}</h4>
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{chatUser.department || chatUser.role}</p>
                </div>
              ))}
              {filteredUsers.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Kullanıcı bulunamadı</p>}
            </>
          ) : (
            <>
              {isManager && (
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="w-full p-3 flex items-center gap-2 text-primary hover:bg-blue-50 border-b border-slate-100 transition-colors text-sm font-medium"
                  data-testid="button-new-group"
                >
                  <Plus className="h-4 w-4" /> Yeni Grup Oluştur
                </button>
              )}
              {filteredGroups.map(group => (
                <div
                  key={group.id}
                  onClick={() => setActiveGroup(group)}
                  className={cn("p-3 cursor-pointer hover:bg-slate-100 transition-colors border-b border-slate-100", activeGroup?.id === group.id && "bg-blue-50 hover:bg-blue-50")}
                  data-testid={`group-${group.id}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{group.name}</h4>
                      <p className="text-xs text-muted-foreground">{group.memberCount} üye</p>
                    </div>
                  </div>
                </div>
              ))}
              {filteredGroups.length === 0 && !isManager && (
                <p className="text-center text-muted-foreground text-sm py-8">Henüz grubunuz yok</p>
              )}
              {filteredGroups.length === 0 && isManager && (
                <p className="text-center text-muted-foreground text-sm py-4 px-3">
                  Henüz grup yok. Yukarıdan yeni grup oluşturun.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex min-h-0 w-full flex-1 flex-col bg-white min-w-0 md:w-3/4">
        {activeTab === "kisiler" ? (
          activeUser ? (
            <>
              {/* Direct chat header */}
              <div className="p-3 border-b flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-2">
                  <div>
                    <h3 className="font-bold text-sm">{activeUser.fullName}</h3>
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-600" /> Çevrimiçi
                    </p>
                  </div>
                </div>
              </div>

              {/* Direct messages */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 bg-slate-50/50 p-4">
                {messages.map(msg => {
                  const isOwn = msg.senderId === user.id;
                  return (
                    <div key={msg.id} className={cn("flex", isOwn ? "justify-end" : "justify-start")} data-testid={`message-${msg.id}`}>
                      <div className={cn("max-w-[70%] p-3 rounded-2xl shadow-sm", isOwn ? "bg-primary text-primary-foreground rounded-br-none" : "bg-white border text-slate-800 rounded-bl-none")}>
                        {renderFileBubble(msg, isOwn)}
                        <p className="text-[10px] mt-1 text-right opacity-70">{formatTime(msg.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
                {messages.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Henüz mesaj yok. İlk mesajı gönderin!</p>}
                <div ref={messagesEndRef} />
              </div>

              {renderInputBar()}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p>Sohbet başlatmak için bir kişi seçin</p>
            </div>
          )
        ) : (
          activeGroup ? (
            <>
              {/* Group chat header */}
              <div className="p-3 border-b flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{activeGroup.name}</h3>
                    <p className="text-xs text-muted-foreground">{activeGroup.memberCount} üye</p>
                  </div>
                </div>
                {(activeGroup.createdBy === user.id || user.role === "super_admin") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => handleDeleteGroup(activeGroup.id, activeGroup.name)}
                    data-testid="button-delete-group"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Group messages */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 bg-slate-50/50 p-4">
                {groupMessages.map(msg => {
                  const isOwn = msg.senderId === user.id;
                  const sender = userMap.get(msg.senderId);
                  const senderName = isOwn ? "Siz" : (sender?.fullName || "Bilinmeyen");
                  return (
                    <div key={msg.id} className={cn("flex", isOwn ? "justify-end" : "justify-start")} data-testid={`group-message-${msg.id}`}>
                      <div className="max-w-[70%]">
                        {!isOwn && <p className="text-[10px] text-muted-foreground mb-1 ml-1 font-medium">{senderName}</p>}
                        <div className={cn("p-3 rounded-2xl shadow-sm", isOwn ? "bg-primary text-primary-foreground rounded-br-none" : "bg-white border text-slate-800 rounded-bl-none")}>
                          {renderFileBubble(msg, isOwn)}
                          <p className="text-[10px] mt-1 text-right opacity-70">{formatTime(msg.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {groupMessages.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Henüz mesaj yok. İlk mesajı gönderin!</p>}
                <div ref={messagesEndRef} />
              </div>

              {renderInputBar()}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <Users className="h-10 w-10 text-slate-300" />
              <p className="text-sm">Sohbet başlatmak için bir grup seçin</p>
              {isManager && (
                <Button variant="outline" size="sm" onClick={() => setShowCreateGroup(true)} data-testid="button-new-group-empty">
                  <Plus className="h-4 w-4 mr-1" /> Yeni Grup Oluştur
                </Button>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
