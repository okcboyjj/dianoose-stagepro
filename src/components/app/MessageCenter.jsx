import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Plus, Send, Users, ChevronRight, Loader2, Pin, Megaphone, Reply, X, FileText, Music, List, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MessageEntity = base44.entities.Message;
const ChannelEntity = base44.entities.Channel;

const REACTIONS = ["❤️", "👍", "🙌", "🔥", "😂", "🎵"];

const CHANNEL_ICONS = { team: "👥", service: "🎶", direct: "💬", production: "🎛" };

function ChannelItem({ channel, isActive, unread, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}
    >
      <span className="text-base">{CHANNEL_ICONS[channel.type] || "#"}</span>
      <div className="flex-1 min-w-0 text-left">
        <p className="font-semibold truncate text-xs">{channel.name}</p>
        {channel.last_message_preview && (
          <p className="text-[10px] opacity-60 truncate">{channel.last_message_preview}</p>
        )}
      </div>
      {unread > 0 && !isActive && (
        <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{unread}</span>
      )}
    </button>
  );
}

function formatTimestamp(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isToday) return timeStr;
  if (isYesterday) return `Yesterday ${timeStr}`;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${timeStr}`;
}

function DateDivider({ label }) {
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 h-px bg-border/30" />
      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-border/30" />
    </div>
  );
}

function MessageBubble({ msg, currentUserId, onReact, onReply, onPin }) {
  const isMe = msg.sender_id === currentUserId;
  const [showReact, setShowReact] = useState(false);

  return (
    <div className={`flex gap-2 group ${isMe ? "flex-row-reverse" : ""}`}>
      {!isMe && (
        <div className="w-7 h-7 rounded-full bg-secondary border border-border/50 flex items-center justify-center text-[10px] font-bold text-foreground shrink-0 mt-1">
          {msg.sender_initials || "?"}
        </div>
      )}
      <div className={`max-w-[75%] space-y-1 ${isMe ? "items-end" : "items-start"} flex flex-col`}>
        {!isMe && <p className="text-[10px] text-muted-foreground font-semibold px-1">{msg.sender_name}</p>}

        {msg.reply_to_preview && (
          <div className={`text-[10px] px-2 py-1 rounded-lg border border-border/40 bg-secondary/40 text-muted-foreground max-w-full ${isMe ? "text-right" : ""}`}>
            <Reply className="w-2.5 h-2.5 inline mr-1" />
            {msg.reply_to_preview}
          </div>
        )}

        <div
          className={`relative rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
            isMe
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-card border border-border/50 text-foreground rounded-tl-sm"
          } ${msg.is_announcement ? "border-2 border-yellow-500/40 bg-yellow-500/5" : ""}`}
        >
          {msg.is_announcement && (
            <div className="flex items-center gap-1 text-yellow-400 text-[10px] font-bold mb-1">
              <Megaphone className="w-3 h-3" /> ANNOUNCEMENT
            </div>
          )}
          {msg.is_pinned && (
            <div className="flex items-center gap-1 text-primary text-[10px] font-bold mb-1">
              <Pin className="w-3 h-3" /> PINNED
            </div>
          )}
          <p className="break-words">{msg.content}</p>

          {/* Link actions */}
          {msg.link_type && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <button className="flex items-center gap-1.5 text-[11px] font-semibold opacity-80 hover:opacity-100 transition-opacity">
                {msg.link_type === "song" && <><Music className="w-3 h-3" /> View Song</>}
                {msg.link_type === "service" && <><List className="w-3 h-3" /> Open Setlist</>}
                {msg.link_type === "chart" && <><FileText className="w-3 h-3" /> Open Chart</>}
              </button>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <p className={`text-[10px] text-muted-foreground/60 px-1 ${isMe ? "text-right" : "text-left"}`}>
          {formatTimestamp(msg.created_date)}
        </p>

        {/* Reactions */}
        {msg.reactions?.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {Object.entries(
              msg.reactions.reduce((acc, r) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {})
            ).map(([emoji, count]) => (
              <button key={emoji} onClick={() => onReact(msg, emoji)} className="flex items-center gap-0.5 bg-secondary/60 border border-border/40 rounded-full px-1.5 py-0.5 text-[11px] hover:bg-secondary transition-colors">
                {emoji} <span className="text-muted-foreground font-semibold">{count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Action row (visible on hover) */}
        <div className={`flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? "flex-row-reverse" : ""}`}>
          <div className="relative">
            <button onClick={() => setShowReact(r => !r)} className="text-[10px] text-muted-foreground hover:text-foreground bg-secondary/40 hover:bg-secondary rounded-lg px-2 py-1 transition-colors flex items-center gap-0.5">
              <Smile className="w-3 h-3" />
            </button>
            {showReact && (
              <div className={`absolute bottom-full mb-1 flex gap-1 bg-card border border-border/50 rounded-xl p-2 shadow-xl z-10 ${isMe ? "right-0" : "left-0"}`}>
                {REACTIONS.map(e => (
                  <button key={e} onClick={() => { onReact(msg, e); setShowReact(false); }} className="text-base hover:scale-125 transition-transform">{e}</button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => onReply(msg)} className="text-[10px] text-muted-foreground hover:text-foreground bg-secondary/40 hover:bg-secondary rounded-lg px-2 py-1 transition-colors flex items-center gap-0.5">
            <Reply className="w-3 h-3" /> Reply
          </button>
          {msg.sender_id === currentUserId && (
            <button onClick={() => onPin(msg)} className="text-[10px] text-muted-foreground hover:text-foreground bg-secondary/40 hover:bg-secondary rounded-lg px-2 py-1 transition-colors flex items-center gap-0.5">
              <Pin className="w-3 h-3" /> {msg.is_pinned ? "Unpin" : "Pin"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateChannelModal({ church, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("team");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const ch = await ChannelEntity.create({
        church_id: church.id,
        name: name.trim(),
        description: desc.trim(),
        type,
        is_default: false,
        last_message_at: new Date().toISOString()
      });
      onCreate(ch);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-4">
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-card border border-border/50 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground">New Channel</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-medium">Channel Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Electric Guitar Team" className="mt-1 bg-background/50 border-border/50 text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-medium">Type</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {[{ id: "team", label: "👥 Team Chat" }, { id: "service", label: "🎶 Service Chat" }, { id: "production", label: "🎛 Production" }, { id: "direct", label: "💬 Direct" }].map(t => (
              <button key={t.id} onClick={() => setType(t.id)} className={`py-2 rounded-xl text-xs font-semibold border transition-all ${type === t.id ? "bg-primary text-primary-foreground border-primary" : "border-border/50 text-muted-foreground hover:border-primary/40"}`}>{t.label}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-medium">Description (optional)</label>
          <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="What is this channel for?" className="mt-1 bg-background/50 border-border/50 text-sm" />
        </div>
        <Button onClick={handleCreate} disabled={saving || !name.trim()} className="w-full bg-primary text-primary-foreground h-10 rounded-xl font-semibold">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Channel"}
        </Button>
      </motion.div>
    </div>
  );
}

export default function MessageCenter({ church, user, services, members }) {
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showChannelList, setShowChannelList] = useState(true);
  const messagesContainerRef = useRef(null);
  const unsubRef = useRef(null);
  const [unreadMap, setUnreadMap] = useState({});

  const loadChannels = useCallback(async () => {
    if (!church?.id) return;
    setLoading(true);
    try {
      let chans = await ChannelEntity.filter({ church_id: church.id });
      // Create defaults if none exist
      if (chans.length === 0) {
        const defaults = [
          { name: "Worship Team", type: "team", is_default: true, icon: "👥" },
          { name: "Production Team", type: "production", is_default: true, icon: "🎛" },
          { name: "General", type: "team", is_default: true, icon: "#" },
        ];
        chans = await Promise.all(defaults.map(d => ChannelEntity.create({ ...d, church_id: church.id, last_message_at: new Date().toISOString() })));
      }
      chans.sort((a, b) => (b.last_message_at || "").localeCompare(a.last_message_at || ""));
      setChannels(chans);
      if (!activeChannel && chans.length > 0) setActiveChannel(chans[0]);
    } finally { setLoading(false); }
  }, [church?.id]);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  const loadMessages = useCallback(async (channelId) => {
    if (!channelId) return;
    try {
      const msgs = await MessageEntity.filter({ channel_id: channelId }, "-created_date", 100);
      setMessages(msgs.reverse());
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (!activeChannel?.id) return;
    loadMessages(activeChannel.id);

    // Real-time subscription — Firestore listeners require an explicit filter, so we scope
    // to every channel in the church (not just the active one) to keep unread badges working.
    if (unsubRef.current) unsubRef.current();
    const channelIds = channels.map(c => c.id);
    if (channelIds.length === 0) return;
    unsubRef.current = MessageEntity.subscribe({ channel_id: { in: channelIds } }, (event) => {
      if (event.data?.channel_id !== activeChannel.id) {
        // Unread for other channel
        setUnreadMap(prev => ({ ...prev, [event.data?.channel_id]: (prev[event.data?.channel_id] || 0) + 1 }));
        return;
      }
      if (event.type === "create") {
        setMessages(prev => [...prev, event.data]);
      } else if (event.type === "update") {
        setMessages(prev => prev.map(m => m.id === event.id ? event.data : m));
      } else if (event.type === "delete") {
        setMessages(prev => prev.filter(m => m.id !== event.id));
      }
    });
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [activeChannel?.id, loadMessages, channels]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const selectChannel = (ch) => {
    setActiveChannel(ch);
    setUnreadMap(prev => ({ ...prev, [ch.id]: 0 }));
    setShowChannelList(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeChannel || sending) return;
    setSending(true);
    const content = input.trim();
    const prevReplyTo = replyTo;
    try {
      const nameParts = [user?.first_name, user?.last_name].filter(Boolean);
      const initials = nameParts.map(p => p[0]).join("").toUpperCase();
      const msgData = {
        church_id: church.id,
        channel_id: activeChannel.id,
        sender_id: user?.user_id || user?.id,
        sender_name: nameParts.join(" ") || "Team Member",
        sender_initials: initials || "?",
        content,
        reactions: [],
        ...(prevReplyTo ? { reply_to_id: prevReplyTo.id, reply_to_preview: prevReplyTo.content?.slice(0, 60) } : {})
      };
      await MessageEntity.create(msgData);
      // Only clear input and reply after successful send
      setInput("");
      setReplyTo(null);
      await ChannelEntity.update(activeChannel.id, {
        last_message_at: new Date().toISOString(),
        last_message_preview: `${nameParts[0] || "Someone"}: ${content.slice(0, 50)}`
      });
    } finally { setSending(false); }
  };

  const handleReact = async (msg, emoji) => {
    const userId = user?.user_id || user?.id;
    const reactions = msg.reactions || [];
    const existing = reactions.findIndex(r => r.emoji === emoji && r.user_id === userId);
    const updated = existing >= 0
      ? reactions.filter((_, i) => i !== existing)
      : [...reactions, { emoji, user_id: userId }];
    await MessageEntity.update(msg.id, { reactions: updated });
  };

  const handlePin = async (msg) => {
    await MessageEntity.update(msg.id, { is_pinned: !msg.is_pinned });
  };

  const pinnedMessages = messages.filter(m => m.is_pinned);
  const currentUserId = user?.user_id || user?.id;

  return (
    <div className="flex gap-0 rounded-2xl overflow-hidden border border-border/30 bg-card/30 h-full min-h-0">

      {/* Channel sidebar */}
      <div className={`${showChannelList ? "flex" : "hidden sm:flex"} flex-col w-full sm:w-64 border-r border-border/30 bg-background/30 shrink-0`}>
        <div className="p-4 border-b border-border/30 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground">Messages</h2>
            <p className="text-[10px] text-muted-foreground">Team & service chats</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary hover:bg-primary/30 transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
          ) : (
            channels.map(ch => (
              <ChannelItem
                key={ch.id}
                channel={ch}
                isActive={activeChannel?.id === ch.id}
                unread={unreadMap[ch.id] || 0}
                onClick={() => selectChannel(ch)}
              />
            ))
          )}
        </div>

        {/* Service channels quick-add */}
        {services?.filter(s => {
          const d = new Date(s.date);
          const now = new Date();
          const days = (d - now) / (1000 * 60 * 60 * 24);
          return days >= 0 && days <= 14;
        }).slice(0, 3).map(svc => (
          <button
            key={svc.id}
            onClick={async () => {
              const existing = channels.find(c => c.service_id === svc.id);
              if (existing) { selectChannel(existing); return; }
              const newCh = await ChannelEntity.create({
                church_id: church.id,
                name: svc.name || "Service Chat",
                type: "service",
                service_id: svc.id,
                last_message_at: new Date().toISOString()
              });
              setChannels(prev => [newCh, ...prev]);
              selectChannel(newCh);
            }}
            className="mx-3 mb-1 flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors border border-dashed border-border/30"
          >
            <span>🎶</span>
            <span className="truncate">{svc.name}</span>
            <Plus className="w-3 h-3 ml-auto shrink-0" />
          </button>
        ))}
      </div>

      {/* Chat area */}
      <div className={`${!showChannelList ? "flex" : "hidden sm:flex"} flex-1 flex-col overflow-hidden`}>
        {activeChannel ? (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-border/30 bg-background/20 flex items-center gap-3 shrink-0">
              <button onClick={() => setShowChannelList(true)} className="sm:hidden w-8 h-8 flex items-center justify-center text-muted-foreground">
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
              <span className="text-lg">{CHANNEL_ICONS[activeChannel.type] || "#"}</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-foreground truncate">{activeChannel.name}</h3>
                {activeChannel.description && <p className="text-[10px] text-muted-foreground truncate">{activeChannel.description}</p>}
              </div>
              <div className="flex items-center gap-1 text-muted-foreground text-xs">
                <Users className="w-3.5 h-3.5" />
                <span>{members?.length || 0}</span>
              </div>
            </div>

            {/* Pinned messages banner */}
            {pinnedMessages.length > 0 && (
              <div className="px-4 py-2 bg-primary/5 border-b border-primary/20 flex items-center gap-2 text-xs text-primary shrink-0">
                <Pin className="w-3 h-3 shrink-0" />
                <span className="truncate font-medium">{pinnedMessages[pinnedMessages.length - 1].content}</span>
              </div>
            )}

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="text-4xl mb-3">{CHANNEL_ICONS[activeChannel.type]}</div>
                  <p className="text-sm font-semibold text-foreground">Start the conversation</p>
                  <p className="text-xs text-muted-foreground mt-1">Be the first to message in #{activeChannel.name}</p>
                </div>
              )}
              {messages.map((msg, i) => {
                const msgDate = msg.created_date ? new Date(msg.created_date).toDateString() : null;
                const prevDate = i > 0 && messages[i - 1].created_date ? new Date(messages[i - 1].created_date).toDateString() : null;
                const showDivider = msgDate && msgDate !== prevDate;
                const now = new Date();
                const today = now.toDateString();
                const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
                const dividerLabel = msgDate === today ? "Today" : msgDate === yesterday.toDateString() ? "Yesterday" : msgDate ? new Date(msg.created_date).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }) : "";
                return (
                  <div key={msg.id}>
                    {showDivider && <DateDivider label={dividerLabel} />}
                    <MessageBubble
                      msg={msg}
                      currentUserId={currentUserId}
                      onReact={handleReact}
                      onReply={setReplyTo}
                      onPin={handlePin}
                    />
                  </div>
                );
              })}
            </div>

            {/* Reply preview */}
            {replyTo && (
              <div className="mx-4 mb-1 flex items-center gap-2 bg-secondary/40 border border-border/40 rounded-xl px-3 py-2">
                <Reply className="w-3.5 h-3.5 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground flex-1 truncate">{replyTo.content}</p>
                <button onClick={() => setReplyTo(null)} className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Input bar */}
            <div className="p-3 border-t border-border/30 bg-background/20 shrink-0">
              <div className="flex items-center gap-2 bg-secondary/30 border border-border/40 rounded-2xl px-3 py-2 focus-within:border-primary/50 transition-all">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder={`Message #${activeChannel.name}...`}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-all active:scale-95 shrink-0"
                >
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <div className="text-5xl mb-4">💬</div>
              <p className="text-sm font-semibold text-foreground">Select a channel</p>
              <p className="text-xs text-muted-foreground mt-1">Choose a channel from the list to start chatting</p>
            </div>
          </div>
        )}
      </div>

      {showCreate && <CreateChannelModal church={church} onClose={() => setShowCreate(false)} onCreate={(ch) => { setChannels(prev => [ch, ...prev]); selectChannel(ch); setShowCreate(false); }} />}
    </div>
  );
}